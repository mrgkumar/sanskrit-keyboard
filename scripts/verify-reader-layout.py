#!/usr/bin/env python3
import argparse
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from typing import Optional

from PIL import Image, ImageChops, ImageOps, ImageStat, ImageDraw


DEFAULT_READER_URL = 'http://127.0.0.1:3000/reader?path=aranyakas%2FTaittiriyopanishat.tex'
DEFAULT_PDF_URL = 'https://raw.githubusercontent.com/stotrasamhita/vedamantra-book/master/aranyakas-pdf/Taittiriyopanishat.pdf'
RESAMPLE_LANCZOS = getattr(Image, 'Resampling', Image).LANCZOS


def run(command, *, cwd: Optional[Path] = None) -> None:
    subprocess.run(command, cwd=str(cwd) if cwd else None, check=True)


def download_file(url, destination):
    with urllib.request.urlopen(url) as response, destination.open('wb') as target:
        shutil.copyfileobj(response, target)


def capture_reader_screenshot(reader_url, output_path, article_only):
    selector = 'main article' if article_only else None
    script = r"""
const { chromium } = require('@playwright/test');

const readerUrl = process.argv[1];
const outputPath = process.argv[2];
const selector = process.argv[3] || '';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: 1 });
  await page.goto(readerUrl, { waitUntil: 'networkidle' });
  if (selector) {
    await page.locator(selector).screenshot({ path: outputPath });
  } else {
    await page.screenshot({ path: outputPath, fullPage: false });
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"""
    command = ['node', '-e', script, reader_url, str(output_path), selector]
    run(command)


def render_pdf_page_one(pdf_path, output_prefix):
    run(['pdftoppm', '-f', '1', '-singlefile', '-png', str(pdf_path), str(output_prefix)])
    return output_prefix.with_suffix('.png')


def trim_non_white(image, threshold=248):
    grayscale = image.convert('L')
    mask = grayscale.point(lambda value: 255 if value < threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
      return image

    left, top, right, bottom = bbox
    padding = 16
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def resize_to_common_width(left, right, width=1200):
    left_ratio = width / left.width
    right_ratio = width / right.width
    left_resized = left.resize((width, max(1, round(left.height * left_ratio))), RESAMPLE_LANCZOS)
    right_resized = right.resize((width, max(1, round(right.height * right_ratio))), RESAMPLE_LANCZOS)
    target_height = max(left_resized.height, right_resized.height)

    def pad(image: Image.Image) -> Image.Image:
      canvas = Image.new('RGB', (width, target_height), 'white')
      canvas.paste(image, (0, 0))
      return canvas

    return pad(left_resized), pad(right_resized)


def compare_images(left, right):
    left_trimmed = trim_non_white(left)
    right_trimmed = trim_non_white(right)
    left_norm, right_norm = resize_to_common_width(left_trimmed, right_trimmed)
    diff = ImageChops.difference(left_norm, right_norm)
    stat = ImageStat.Stat(diff)
    rms = sum(value * value for value in stat.rms) ** 0.5
    return {
        'rms': rms,
        'left_width': float(left_trimmed.width),
        'left_height': float(left_trimmed.height),
        'right_width': float(right_trimmed.width),
        'right_height': float(right_trimmed.height),
    }, left_trimmed, right_trimmed, left_norm, right_norm, diff


def make_contact_sheet(left, right, diff):
    width = max(left.width, right.width, diff.width)
    margin = 24
    header = 40
    total_height = header + left.height + margin + header + right.height + margin + header + diff.height + margin * 2
    sheet = Image.new('RGB', (width * 3 // 2, total_height), 'white')
    draw = ImageDraw.Draw(sheet)
    y = margin
    draw.text((margin, y), 'Reader crop', fill='black')
    y += header
    sheet.paste(left, (margin, y))
    y += left.height + margin
    draw.text((margin, y), 'PDF crop', fill='black')
    y += header
    sheet.paste(right, (margin, y))
    y += right.height + margin
    draw.text((margin, y), 'Diff', fill='black')
    y += header
    sheet.paste(diff, (margin, y))
    return sheet


def main() -> int:
    parser = argparse.ArgumentParser(description='Compare the Reader layout against the PDF page 1 layout.')
    parser.add_argument('--reader-url', default=DEFAULT_READER_URL)
    parser.add_argument('--pdf-url', default=DEFAULT_PDF_URL)
    parser.add_argument('--out-dir', default='/tmp/reader-layout-verify')
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='reader-layout-') as tmp:
        tmp_dir = Path(tmp)
        reader_png = tmp_dir / 'reader.png'
        pdf_file = tmp_dir / 'source.pdf'
        pdf_prefix = tmp_dir / 'pdf-page-1'

        print(f'Capturing Reader screenshot from {args.reader_url}', flush=True)
        capture_reader_screenshot(args.reader_url, reader_png, article_only=True)

        print(f'Downloading PDF from {args.pdf_url}', flush=True)
        download_file(args.pdf_url, pdf_file)

        print('Rendering PDF page 1', flush=True)
        pdf_png = render_pdf_page_one(pdf_file, pdf_prefix)

        reader_image = Image.open(reader_png).convert('RGB')
        pdf_image = Image.open(pdf_png).convert('RGB')
        metrics, reader_crop, pdf_crop, reader_norm, pdf_norm, diff = compare_images(reader_image, pdf_image)

        reader_crop_path = out_dir / 'reader-crop.png'
        pdf_crop_path = out_dir / 'pdf-crop.png'
        reader_norm_path = out_dir / 'reader-normalized.png'
        pdf_norm_path = out_dir / 'pdf-normalized.png'
        diff_path = out_dir / 'diff.png'
        sheet_path = out_dir / 'contact-sheet.png'

        reader_crop.save(reader_crop_path)
        pdf_crop.save(pdf_crop_path)
        reader_norm.save(reader_norm_path)
        pdf_norm.save(pdf_norm_path)
        diff.save(diff_path)
        make_contact_sheet(reader_crop, pdf_crop, diff).save(sheet_path)

        print(
            'layout_metrics='
            f"rms:{metrics['rms']:.2f} "
            f"reader:{int(metrics['left_width'])}x{int(metrics['left_height'])} "
            f"pdf:{int(metrics['right_width'])}x{int(metrics['right_height'])}",
            flush=True,
        )
        print(f'outputs={out_dir}', flush=True)
        return 0


if __name__ == '__main__':
    raise SystemExit(main())
