// MATTY 使い方ガイド 補助スクリプト（無くても本文は読めます）
// チェックリストの状態だけを保存します。古いブラウザでも動くよう、
// try/catch で囲み、対応していない場合は何もしません。
(function () {
  try {
    var boxes = document.querySelectorAll('.check-item input[type="checkbox"]');
    if (!boxes || boxes.length === 0) return;

    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var key = 'matty-guide-check-' + box.id;
      var saved = window.localStorage ? window.localStorage.getItem(key) : null;
      if (saved === '1') box.checked = true;
      box.addEventListener('change', (function (k, b) {
        return function () {
          try {
            if (window.localStorage) {
              window.localStorage.setItem(k, b.checked ? '1' : '0');
            }
          } catch (e) {}
        };
      })(key, box));
    }
  } catch (e) {
    // 何もしない（本文の閲覧には影響しません）
  }
})();
