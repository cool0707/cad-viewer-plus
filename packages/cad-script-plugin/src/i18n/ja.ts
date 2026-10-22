import type { ScriptLabels } from './index'

/**
 * Japanese UI strings for the CAD script console.
 *
 * Keys must stay in sync with {@link scriptEn}.
 */
export const scriptJa: ScriptLabels = {
  scriptTab: 'スクリプト',
  scriptTitle: 'CAD スクリプト',
  scriptRun: '実行',
  scriptRunning: '実行中…',
  scriptHelp: 'スクリプトのヘルプ',
  scriptResize: '結果パネルのサイズを変更',
  scriptPlaceholder: '関数の本体を記述します。引数は cad だけです。',
  scriptHint: 'Ctrl+Enter で実行。「.」または Ctrl+Space で cad を補完します。',
  scriptSuccess: '成功',
  scriptFailed: '失敗',
  scriptReturnValue: '戻り値',
  scriptNoReturn: 'スクリプトは値を返しませんでした。',
  scriptLog: 'ログ',
  scriptHighlighted: 'ハイライト',
  scriptCreated: '作成',
  scriptEmptyResult:
    'スクリプトを実行すると、戻り値、ログ、エラーが表示されます。',
  scriptNoDocument: '先に図面を開くか作成してください。',
  scriptReadOnly: '図面は読み取り専用で開かれています。',
  scriptNoView: '図面のビューを利用できません。',
  scriptTimeout:
    'スクリプトが時間またはステップの上限を超えたため停止しました。',
  scriptNotJson: '戻り値が JSON ではありません。',
  scriptEmptyCode: 'スクリプトが空です。',
  scriptTooLarge: 'スクリプトが長すぎます。',
  scriptDynamicAccess: 'cad への計算されたプロパティアクセスは使用できません。',
  scriptForbiddenSyntax: '使用できない構文',
  scriptForbiddenIdentifier: '使用できない識別子',
  scriptForbiddenMember: '使用できないメンバー',
  scriptUnknownApi: '不明な cad API',
  scriptExamples: 'サンプル',
  scriptExamplesSearch: 'サンプルを検索',
  scriptExamplesEmpty: '検索に一致するサンプルはありません。',
  scriptExamplesUse: 'このスクリプトを使う',
  scriptExamplesClose: 'サンプルを閉じる'
}
