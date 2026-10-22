import type { AgentChatLabels } from './index'

/**
 * Japanese UI strings for the CAD Agent panel.
 *
 * Keys must stay in sync with {@link agentEn}.
 */
export const agentJa: AgentChatLabels = {
  tab: 'エージェント',
  title: 'CAD エージェント',
  settings: '設定',
  clear: '新しいチャット',
  close: '閉じる',
  provider: 'プロバイダー',
  providerDeepseek: 'DeepSeek',
  providerDeepseekVl: 'DeepSeek VL (画像対応)',
  providerDeepseekVlHint:
    'OpenAI 互換の画像対応エンドポイントを使います (既定: SiliconFlow)。自前でホストした vLLM の場合は、ベース URL をサーバーに設定してください (例: http://127.0.0.1:8000/v1)。',
  providerOpenai: 'OpenAI',
  providerAnthropic: 'Anthropic',
  providerOpenaiCompatible: 'OpenAI 互換',
  baseUrl: 'ベース URL',
  baseUrlHint:
    'ほとんどのゲートウェイでは /v1 を含める必要があります (例: https://ai-api.example.com/v1)。ホスト名だけの URL は自動で補正されます。',
  model: 'モデル',
  visionModels: '画像対応モデル',
  textModels: 'テキスト専用モデル',
  customModel: 'カスタムモデル…',
  customModelName: 'カスタムモデル名',
  modelSupportsVision: '画像入力に対応',
  modelTextOnly: 'テキストのみ — 画像の添付は無効です',
  apiKey: 'API キー',
  saveSettings: '設定を保存',
  emptyHint:
    '作図したい内容を説明するか、参考画像 (スケッチ、スクリーンショット、間取り図) を添付してください。',
  toolPrefix: 'ツール',
  copyTool: 'ツール呼び出しをコピー (入力と出力)',
  toolCopied: 'コピーしました',
  inputPlaceholder: '依頼内容を入力…',
  attachImage: '画像を添付',
  removeAttachment: '削除',
  imageAlt: '添付画像',
  imageOnlyRequest:
    '添付した参考画像を分析して、これを CAD で作図するのを手伝ってください。',
  prepareImageFailed:
    '添付画像を準備できませんでした。もっと小さい PNG または JPEG を試してください。',
  errorTitle: 'エラーが発生しました',
  dismissError: '閉じる',
  send: '送信',
  stop: '停止',
  working: '処理中…',
  agentMode: 'エージェントモード',
  agentModeSimple: 'シンプル',
  agentModeHighInference: '高推論',
  agentModeSimpleHint:
    '既定。高速 — 計測 API による自己チェックのみで、スクリーンショットや画像による検証は行いません。',
  agentModeHighInferenceHint:
    '複雑な作業向けのオプション。スクリーンショットを許可し、スクリーンショットと画像対応モデルで検証します (最大 5 回)。画像対応モデルが必要です。',
  highInferenceRequiresVision: '高推論モードには画像対応モデルが必要です。',
  verificationTitle: '作図の検証',
  verifying: '図面のスクリーンショットを依頼内容と参考画像と比較しています…',
  verificationPassed: '検証に合格しました — 図面は依頼内容と一致しています。',
  verificationFailed: '検証に失敗しました — 次の問題があります:',
  verificationSkipped: '検証をスキップしました',
  verificationError: '検証エラー',
  verificationContinuing: '図面の最適化を続けています…',
  verificationMaxAttempts: '最大試行回数内に検証に合格しませんでした。',
  referenceImages: '参考画像',
  drawingScreenshot: '現在の図面のスクリーンショット',
  unsavedSettings: 'メッセージを送信する前に設定を保存してください。',
  missingApiKey: 'メッセージを送信する前に設定で API キーを設定してください。'
}
