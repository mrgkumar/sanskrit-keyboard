import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const USER_TEXT = `/udakashAnti-mantrA:

kR^i_Nu_Shva pAja_: prasi'tiM_ na pR^i_thvIM yA_hi rAje_vAma'vA_MM~_ ibhe'na| tR^i_ShvImanu_ prasi'tiM drUNA_no.astA'si_ vidhya' ra_kShasa_stapi'ShThai:| tava' bhra_mAsa' Ashu_yA pa'ta_ntyanu' spR^isha dhR^iSha_tA shoshu'chAna:| tapUM^~'Shyagne ju_hvA' pata_~NgAnasa'ndito_ vi sR^i'ja_ viShva'gu_lkA:| prati_ spasho_ vi sR^i'ja_ tUrNi'tamo_ bhavA' pA_yurvi_sho a_syA ada'bdha:| yo no' dU_re a_ghashaMM~'so_ yo antyagne_ mAki'ShTe_ vyathi_rA da'dharShIt ||1||

uda'gne tiShTha_ pratyA..ata'nuShva_ nya'mitrAMM~' oShatAttigmahete| yo no_ arA'tiMM~ samidhAna cha_kre nI_chA taM dha'kShyata_saM na shuShkam''| U_rdhvo bha'va_ prati' vi_dhyAdhya_smadA_viShkR^i'NuShva_ daivyA''nyagne| ava' sthi_rA ta'nuhi yAtu_jUnA''m jA_mimajA'miM_ pra mR^i'NIhi_ shatrUn'| sa te' jAnAti suma_tiM ya'viShTha_ ya Iva'te_ brahma'Ne gA_tumaira't ||2||

vishvA''nyasmai su_dinA'ni rA_yo dyu_mnAnya_ryo vi duro' a_bhi dyau''t| seda'gne astu su_bhaga': su_dAnu_ryastvA_ nitye'na ha_viShA_ ya u_kthai:| piprI'Shati_ sva Ayu'Shi duro_Ne vishveda'smai su_dinA_ sA.asa'di_ShTi:| archA'mi te suma_tiM ghoShya_rvAkhsaM te' vA_vAtA' jaratAmi_ya~NgI: ||3||

svashvA''stvA su_rathA' marjayemA_sme kSha_trANi' dhAraye_ranu_ dyUn| i_ha tvA_ bhUryA cha're_dupa_ tmandoShA'-vastardIdi_vAMM~-sa_manu_ dyUn| krIDA'ntastvA su_mana'sa: sapemA_bhi dyu_mnA ta'sthi_vAMM~so_ janA'nAm| yastvA_ svashva': suhira_Nyo a'gna upa_yAti_ vasu'matA_ rathe'na| tasya' trA_tA bha'vasi_ tasya_ sakhA_ yasta' Ati_thyamA'nu_Shagjujo'Shat| ma_ho ru'jAmi ba_ndhutA_ vacho'bhi_stanmA' pi_turgota'mA_danvi'yAya ||4||

tvaM no' a_sya vacha'sashchikiddhi_ hota'ryaviShTha sukrato_ damU'nA:| asva'pnajasta_raNa'ya: su_shevA_ ata'ndrAso.avR^i_kA ashra'miShThA:| te pA_yava': sa_dhriya'~ncho ni_ShadyA.agne_ tava' na: pAntvamUra| ye pA_yavo' mAmate_yaM te' agne_ pashya'nto a_ndhaM du'ri_tAdara'kShan| ra_rakSha_ tAnthsu_kR^ito' vi_shvave'dA_ diphsa'nta_ idri_pavo_ nA ha' debhu: ||5||

tvayA' va_yaMM~ sa'dha_nya'stvotA_stava' praNI''tyashyAma_ vAjAn'| u_bhA shaMM~sA' sUdaya satyatAte.anuShThu_yA kR^i'NuhyahrayANa| a_yA te' agne sa_midhA' vidhema_ prati_ stomaMM~' sha_syamA'naM gR^ibhAya| dahA_.a_shaso' ra_kShasa': pA_hya'smAndru_ho ni_do.ami'tramaho ava_dyAt| ra_kSho_haNa'm vA_jina_mA..aji'gharmi mi_traM prathi'ShTha_mupa' yAmi_ sharma'| shishA'no a_gni: kratu'bhi_: sami'ddha_: sa no_ divA_ sa ri_Sha: pA'tu_ naktam'' ||6||

vi jyoti'ShA bR^iha_tA bhA''tya_gnirA_virvishvA'ni kR^iNute mahi_tvA| prAde'vIrmA_yA: sa'hate du_revA_: shishI'te_ shR^i~Nge_ rakSha'se vi_nikShe''| u_ta svA_nAso' di_viSha'ntva_gnesti_gmAyu'dhA_ rakSha'se_ hanta_vA u'| made' chidasya_ praru'janti_ bhAmA_ na va'rante pari_bAdho_ ade'vI: ||7||[1|2|14]

indra'm vo vi_shvata_spari_ havA'mahe_ jane''bhya:| a_smAka'mastu_ keva'la:| indraM_ naro' ne_madhi'tA havante_ yatpAryA' yu_naja'te_ dhiya_stA:| shUro_ nR^iShA'tA_ shava'sashchakA_na A goma'ti vra_je bha'jA_ tvaM na':| i_ndri_yANi' shatakrato_ yA te_ jane'Shu pa_~nchasu'| indra_ tAni' ta_ A vR^i'Ne| anu' te dAyi ma_ha i'ndri_yAya' sa_trA te_ vishva_manu' vR^itra_hatye''| anu' kSha_tramanu_ saho' yaja_trendra' de_vebhi_ranu' te nR^i_Shahye'' ||8||

A yasmi''nthsa_pta vA'sa_vAstiShTha'nti svA_ruho' yathA| RRiShi'rmbox{}ha dIrgha_shrutta'ma_ indra'sya gha_rmo ati'thi:| A_mAsu' pa_kvamaira'ya_ A sUryaMM~' rohayo di_vi| gha_rmaM na sAma'ntapatA suvR^i_ktibhi_rjuShTaM_ girva'Nase_ gira':| indra_midgA_thino' bR^i_hadindra'ma_rkebhi'ra_rkiNa':| indraM_ vANI'ranUShata| gAya'nti tvA gAya_triNo.archa'ntya_rkama_rkiNa': ||9||

bra_hmANa'stvA shatakrata_vudva_MM~_shami'va yemire| a_MM~_ho_muche_ pra bha'remA manI_ShAmo'ShiShTha_dAvanne' suma_tiM gR^i'NA_nA:| i_dami'ndra_ prati_ ha_vyaM gR^i'bhAya sa_tyA: sa'ntu_ yaja'mAnasya_ kAmA'':| vi_veSha_ yanmA' dhi_ShaNA' ja_jAna_ stavai' pu_rA pAryA_dindra_mahna':| aMM~ha'so_ yatra' pI_para_dyathA' no nA_veva_ yAnta'mu_bhaye' havante| pra sa_mrAjaM' pratha_mama'dhva_rANA'maMM~ho_muchaM' vR^iSha_bhaM ya_j~niyA'nAm ||10||

a_pAM napA'tamashvinA_ haya'ntama_sminna'ra indri_yaM dha'tta_moja':| vi na' indra_ mR^idho' jahi nI_chA ya'chCha pR^itanya_ta:| a_dha_spa_daM tamIM'' kR^idhi_ yo a_smAMM~ a'bhi_dAsa'ti| indra' kSha_trama_bhi vA_mamojo.ajA'yathA vR^iShabha charmbox{}ShaNI_nAm| apA'.anudo_ jana'mamitra_yanta'mu_ruM de_vebhyo' akR^iNoru lo_kam| mR^i_go na bhI_ma: ku'cha_ro gi'ri_ShThA: pa'rA_vata_ A ja'gAmA_ para'syA: ||11||

sR^i_kaMM~ sa_MM~_shAya' pa_vimi'ndra ti_gmaM vi shatrU''n tADhi_ vi mR^idho' nudasva| vi shatrU_n_ vi mR^idho' nuda_ vi vR^i_trasya_ hanU' ruja| vi ma_nyumi'ndra bhAmi_to'.amitra'syAbhi_dAsa'ta:| trA_tAra_mindra'mavi_tAra_mindra_MM~_ have'have su_hava_MM~_ shUra_mindram''| hu_ve nu sha_kraM pu'ruhU_tamindraM^~' sva_sti no' ma_ghavA' dhA_tvindra':| mA te' a_syAMM~ sa'hasAva_n pari'ShTAva_dhAya' bhUma hariva: parA_dai ||12||

trAya'sva no.avR^i_kebhi_rvarU'thai_stava' pri_yAsa': sU_riShu' syAma| ana'vaste_ ratha_mashvA'ya takSha_n tvaShTA_ vajraM' puruhUta dyu_mantam''| bra_hmANa_ indraM' ma_haya'nto a_rkairava'rdhaya_nnaha'ye_ hanta_vA u'| vR^iShNe_ yatte_ vR^iSha'No a_rkamarchA_nindra_ grAvA'No_ adi'ti: sa_joShA'':| a_na_shvAso_ ye pa_vayo'.ara_thA indre'ShitA a_bhyava'rtanta_ dasyUn' ||17||`;

const LONG_USER_TEXT = `${USER_TEXT}\n\n${USER_TEXT}`;

test('immersive navigator keeps its own scroll and never occludes the document text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 });

  await page.goto(APP_URL);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('sanskrit-keyboard-visited', 'true');
  });
  await page.reload();

  const newSessionBtn = page.getByRole('button', { name: /New Session/i });
  if (await newSessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newSessionBtn.click();
  }

  const textarea = page.getByTestId('sticky-itrans-input');
  await expect(textarea).toBeVisible({ timeout: 15000 });
  await textarea.fill(LONG_USER_TEXT);

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();

  const words = page.locator('[data-testid="document-immersive-primary-pane"] [data-target-index]');
  const wordCount = await words.count();
  for (let i = 0; i < Math.min(wordCount, 80); i++) {
    const word = words.nth(i);
    await word.click();
    await page.getByLabel('Highlight yellow').click();
  }

  const content = page.getByTestId('document-immersive-scroll-region');
  const primaryPane = page.getByTestId('document-immersive-primary-pane');
  const navigator = page.getByTestId('annotation-navigator');
  const navigatorScroll = page.getByTestId('annotation-navigator-scroll');

  await expect(navigator).toBeVisible();
  await expect(navigatorScroll).toBeVisible();

  const contentBox = await content.boundingBox();
  const primaryBox = await primaryPane.boundingBox();
  const navigatorBox = await navigator.boundingBox();
  if (!contentBox || !primaryBox || !navigatorBox) {
    throw new Error('Missing layout boxes');
  }

  expect(primaryBox.x + primaryBox.width).toBeLessThanOrEqual(navigatorBox.x - 4);

  const initialContentScrollTop = await content.evaluate((el) => el.scrollTop);
  const initialNavigatorScrollTop = await navigatorScroll.evaluate((el) => el.scrollTop);
  const navigatorCanScroll = await navigatorScroll.evaluate((el) => el.scrollHeight > el.clientHeight);

  await content.hover();
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(250);

  const contentScrollAfterWheel = await content.evaluate((el) => el.scrollTop);
  const navigatorScrollAfterWheel = await navigatorScroll.evaluate((el) => el.scrollTop);
  expect(contentScrollAfterWheel).toBeGreaterThan(initialContentScrollTop);
  expect(navigatorScrollAfterWheel).toBe(initialNavigatorScrollTop);

  if (navigatorCanScroll) {
    await navigatorScroll.hover();
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(250);

    const contentScrollAfterNavigatorWheel = await content.evaluate((el) => el.scrollTop);
    const navigatorScrollAfterNavigatorWheel = await navigatorScroll.evaluate((el) => el.scrollTop);
    expect(navigatorScrollAfterNavigatorWheel).toBeGreaterThan(initialNavigatorScrollTop);
    expect(contentScrollAfterNavigatorWheel).toBe(contentScrollAfterWheel);
  }
});
