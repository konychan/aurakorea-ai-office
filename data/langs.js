/* 번역 언어 목록 — 언어 추가는 이 파일 한 곳만 수정한다.
   화면(번역실 업로드 창)과 번역 도구(tools/translate)가 같은 목록을 쓴다.

   core:true  = 대표님이 주기적으로 많이 쓰시는 3대 언어 (아르헨티나 · 영어 · 한국어)
   rtl:true   = 오른쪽에서 왼쪽으로 쓰는 언어. 글자만 바꾸므로 문단 방향은 원본 그대로 남는다
                (원본 훼손 금지 원칙 때문에 일부러 바꾸지 않는다 — 검수 때 확인 대상)

   ★ 목록에 없는 언어도 번역할 수 있다. 업로드 창에서 "직접 입력"을 고르시면 된다.
     도구는 어떤 언어 코드든 그대로 받는다. */
export const LANGS = [
  { code:'es-AR', ko:'스페인어 (아르헨티나)', en:'Spanish (Argentina)', core:true },
  { code:'en',    ko:'영어',                  en:'English',             core:true },
  { code:'ko',    ko:'한국어',                en:'Korean',              core:true },

  { code:'es-ES', ko:'스페인어 (스페인)',     en:'Spanish (Spain)' },
  { code:'ar',    ko:'아랍어',                en:'Arabic', rtl:true },
  { code:'pt-BR', ko:'포르투갈어 (브라질)',   en:'Portuguese (Brazil)' },
  { code:'fr',    ko:'프랑스어',              en:'French' },
  { code:'de',    ko:'독일어',                en:'German' },
  { code:'it',    ko:'이탈리아어',            en:'Italian' },
  { code:'ru',    ko:'러시아어',              en:'Russian' },
  { code:'zh-CN', ko:'중국어 (간체)',         en:'Chinese (Simplified)' },
  { code:'zh-TW', ko:'중국어 (번체)',         en:'Chinese (Traditional)' },
  { code:'ja',    ko:'일본어',                en:'Japanese' },
  { code:'vi',    ko:'베트남어',              en:'Vietnamese' },
  { code:'th',    ko:'태국어',                en:'Thai' },
  { code:'id',    ko:'인도네시아어',          en:'Indonesian' },
  { code:'tr',    ko:'튀르키예어',            en:'Turkish' },
  { code:'pl',    ko:'폴란드어',              en:'Polish' },
  { code:'nl',    ko:'네덜란드어',            en:'Dutch' },
  { code:'hi',    ko:'힌디어',                en:'Hindi' },
];

export const CORE_LANGS = LANGS.filter(l => l.core);

/** 언어 코드 → 한국어 이름. 목록에 없으면 코드를 그대로 돌려준다. */
export function langName(code){
  const l = LANGS.find(x => x.code === code);
  return l ? l.ko : code;
}
