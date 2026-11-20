/* ============================================================
   ROUTE FORGE — interface language (zh / en)
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  let lang = 'zh';

  function setLang(value) {
    lang = value === 'en' ? 'en' : 'zh';
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  }

  function getLang() {
    return lang;
  }

  function L(zh, en) {
    return lang === 'en' && en != null ? en : zh;
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const value = lang === 'en' ? el.dataset.en : el.dataset.zh;
      if (value != null) el.textContent = value;
    });
    scope.querySelectorAll('[data-zh-title]').forEach(el => {
      const value = lang === 'en' ? el.dataset.enTitle : el.dataset.zhTitle;
      if (value != null) el.title = value;
    });
    scope.querySelectorAll('[data-zh-aria]').forEach(el => {
      const value = lang === 'en' ? el.dataset.enAria : el.dataset.zhAria;
      if (value != null) el.setAttribute('aria-label', value);
    });
    scope.querySelectorAll('[data-zh-placeholder]').forEach(el => {
      const value = lang === 'en' ? el.dataset.enPlaceholder : el.dataset.zhPlaceholder;
      if (value != null) el.placeholder = value;
    });
    if (scope === document) {
      document.title = L('ROUTE FORGE — 银河城关卡路线设计器', 'ROUTE FORGE — Metroidvania Route Designer');
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute('content', L(
          'ROUTE FORGE — 面向银河城游戏的 2D 路线与 3D 体块关卡设计器',
          'ROUTE FORGE — a 2D route and 3D massing level designer for Metroidvania games'
        ));
      }
    }
  }

  Object.assign(MV, { setLang, getLang, L, applyI18n });
})(window);
