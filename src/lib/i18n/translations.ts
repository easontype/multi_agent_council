export type SupportedLocale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko'

export interface UiMessages {
  // Navigation
  nav_dashboard: string
  nav_reviews: string
  nav_papers: string
  nav_compare: string
  nav_api_keys: string
  nav_new_analysis: string
  nav_sign_out: string
  nav_free_plan: string

  // Home page
  home_greeting: string
  home_subtitle: string
  home_domain_label: string
  home_recent_reviews: string
  home_stats_sessions: string
  home_stats_papers: string

  // Domain names
  domain_general: string
  domain_materials: string
  domain_biomedical: string
  domain_physics: string

  // Paper input
  input_arxiv_placeholder: string
  input_pdf_placeholder: string
  input_fetch_preview: string
  input_upload_pdf: string
  input_confirm: string
  input_reset: string
  input_fetching: string
  input_processing: string
  input_mode_review: string
  input_mode_review_desc: string
  input_mode_debate: string
  input_mode_debate_desc: string
  input_start_review: string
  input_start_debate: string

  // Review setup
  setup_mode_critique: string
  setup_mode_critique_desc: string
  setup_mode_gap: string
  setup_mode_gap_desc: string
  setup_rounds_label: string
  setup_rounds_1: string
  setup_rounds_2: string
  setup_launch: string
  setup_launching: string

  // Debate setup
  debate_option_a: string
  debate_option_b: string
  debate_context_label: string
  debate_context_placeholder: string
  debate_roles_label: string
  debate_launch: string
  debate_launching: string

  // Compare
  compare_title: string
  compare_subtitle: string
  compare_add_paper: string
  compare_run: string
  compare_running: string
  compare_new: string
  compare_verdict: string

  // Status labels
  status_concluded: string
  status_running: string
  status_pending: string
  status_failed: string
  status_ready: string
  status_processing: string

  // Table headers
  table_title: string
  table_status: string
  table_when: string
  table_paper: string
  table_sessions: string
  table_updated: string
  table_topic: string
  table_divergence: string
  table_rounds: string
  table_dimension: string

  // Actions
  action_new_review: string
  action_view_all_reviews: string
  action_delete: string
  action_retry: string
  action_search_reviews: string
  action_search_papers: string
  action_start_first: string

  // Home stats
  home_stat_total: string
  home_stat_all_time: string
  home_stat_this_week: string
  home_stat_weekly_limit: string
  home_stat_concluded: string
  home_stat_completed: string
  home_no_sessions: string
  home_sessions_today: string
  home_upgrade_banner: string

  // Page headings
  page_papers: string
  page_papers_subtitle: string
  page_new_analysis: string
  page_new_analysis_subtitle: string
  page_configure_review: string
  page_configure_debate: string

  // Debate setup extra
  debate_positions_label: string
  debate_side_a: string
  debate_side_b: string
  debate_side_a_placeholder: string
  debate_side_b_placeholder: string
  debate_context_optional_label: string
  debate_roles_selected: string
  debate_error_sides: string
  debate_error_roles: string

  // Common
  common_loading: string
  common_error: string
  common_back: string
  common_cancel: string
  common_save: string
  common_or: string
  common_search: string
  common_no_results: string
}

const en: UiMessages = {
  nav_dashboard: 'Dashboard',
  nav_reviews: 'Reviews',
  nav_papers: 'Papers',
  nav_compare: 'Compare',
  nav_api_keys: 'API Keys',
  nav_new_analysis: 'New Analysis',
  nav_sign_out: 'Sign out',
  nav_free_plan: 'Free plan',

  home_greeting: 'Good morning',
  home_subtitle: 'Upload a paper or enter an arXiv ID to begin.',
  home_domain_label: 'Research domain',
  home_recent_reviews: 'Recent Reviews',
  home_stats_sessions: 'Sessions',
  home_stats_papers: 'Papers',

  domain_general: 'General',
  domain_materials: 'Materials',
  domain_biomedical: 'Biomedical',
  domain_physics: 'Physics',

  input_arxiv_placeholder: 'arXiv ID or URL (e.g. 2401.00001)',
  input_pdf_placeholder: 'Drop a PDF here, or click to browse',
  input_fetch_preview: 'Preview',
  input_upload_pdf: 'Upload PDF',
  input_confirm: 'Confirm — start analysis',
  input_reset: 'Reset',
  input_fetching: 'Fetching…',
  input_processing: 'Processing…',
  input_mode_review: 'Review Paper',
  input_mode_review_desc: '5 specialist reviewers critique the paper and deliver a structured verdict.',
  input_mode_debate: 'Adversarial Debate',
  input_mode_debate_desc: 'Two AI teams debate competing approaches with a neutral moderator.',
  input_start_review: 'Start Review →',
  input_start_debate: 'Start Debate →',

  setup_mode_critique: 'Critique',
  setup_mode_critique_desc: 'Multi-perspective review with Accept / Major / Minor / Reject decision.',
  setup_mode_gap: 'Gap Analysis',
  setup_mode_gap_desc: 'Identify research gaps, missing elements, and improvement opportunities.',
  setup_rounds_label: 'Rounds',
  setup_rounds_1: '1 round',
  setup_rounds_2: '2 rounds',
  setup_launch: 'Launch Review',
  setup_launching: 'Launching…',

  debate_option_a: 'Option A',
  debate_option_b: 'Option B',
  debate_context_label: 'Context',
  debate_context_placeholder: 'What should the debate focus on? (optional)',
  debate_roles_label: 'Select roles (2–3)',
  debate_launch: 'Launch Debate',
  debate_launching: 'Launching…',

  compare_title: 'Compare Papers',
  compare_subtitle: 'Enter 2–4 arXiv IDs. The AI will compare methodology, contributions, and limitations side by side.',
  compare_add_paper: 'Add paper',
  compare_run: 'Compare',
  compare_running: 'Comparing…',
  compare_new: 'New comparison',
  compare_verdict: 'Synthesis Verdict',

  status_concluded: 'Concluded',
  status_running: 'Running',
  status_pending: 'Pending',
  status_failed: 'Failed',
  status_ready: 'Ready',
  status_processing: 'Processing',

  table_title: 'Title',
  table_status: 'Status',
  table_when: 'When',
  table_paper: 'Paper',
  table_sessions: 'Sessions',
  table_updated: 'Updated',
  table_topic: 'Topic',
  table_divergence: 'Divergence',
  table_rounds: 'Rounds',
  table_dimension: 'Dimension',

  action_new_review: 'New Review',
  action_view_all_reviews: 'View all reviews →',
  action_delete: 'Delete',
  action_retry: 'Retry',
  action_search_reviews: 'Search reviews…',
  action_search_papers: 'Search papers or arXiv ID',
  action_start_first: 'Start the first one.',

  home_stat_total: 'Total sessions',
  home_stat_all_time: 'all time',
  home_stat_this_week: 'This week',
  home_stat_weekly_limit: 'weekly limit',
  home_stat_concluded: 'Concluded',
  home_stat_completed: 'completed',
  home_no_sessions: 'No sessions yet today',
  home_sessions_today: 'session(s) today',
  home_upgrade_banner: 'Welcome to Pro! You now have 50 reviews/day. Enjoy.',

  page_papers: 'Papers',
  page_papers_subtitle: 'Cached paper assets and the review sessions attached to them',
  page_new_analysis: 'New Analysis',
  page_new_analysis_subtitle: 'Enter an arXiv ID, URL, or upload a PDF to get started.',
  page_configure_review: 'Configure Review',
  page_configure_debate: 'Configure Debate',

  debate_positions_label: 'Positions',
  debate_side_a: 'Side A — For',
  debate_side_b: 'Side B — Against',
  debate_side_a_placeholder: 'e.g. The methodology is sound',
  debate_side_b_placeholder: 'e.g. The results are overstated',
  debate_context_optional_label: 'Context (optional)',
  debate_roles_selected: 'Expert Roles',
  debate_error_sides: 'Both sides are required',
  debate_error_roles: 'Select at least one expert role',

  common_loading: 'Loading…',
  common_error: 'Something went wrong.',
  common_back: 'Back',
  common_cancel: 'Cancel',
  common_save: 'Save',
  common_or: 'or',
  common_search: 'Search…',
  common_no_results: 'No results found.',
}

const zhTW: UiMessages = {
  nav_dashboard: '首頁',
  nav_reviews: '審查記錄',
  nav_papers: '論文庫',
  nav_compare: '比較論文',
  nav_api_keys: 'API 金鑰',
  nav_new_analysis: '新增分析',
  nav_sign_out: '登出',
  nav_free_plan: '免費方案',

  home_greeting: '你好',
  home_subtitle: '上傳論文或輸入 arXiv ID 以開始分析。',
  home_domain_label: '研究領域',
  home_recent_reviews: '最近審查',
  home_stats_sessions: '工作階段',
  home_stats_papers: '論文',

  domain_general: '通用',
  domain_materials: '材料科學',
  domain_biomedical: '生物醫學',
  domain_physics: '物理',

  input_arxiv_placeholder: 'arXiv ID 或網址（例如 2401.00001）',
  input_pdf_placeholder: '拖放 PDF 到此處，或點擊選擇',
  input_fetch_preview: '預覽',
  input_upload_pdf: '上傳 PDF',
  input_confirm: '確認 — 開始分析',
  input_reset: '重設',
  input_fetching: '擷取中…',
  input_processing: '處理中…',
  input_mode_review: '審查論文',
  input_mode_review_desc: '5 位專業審查員評析論文，給出結構化裁決。',
  input_mode_debate: '對抗辯論',
  input_mode_debate_desc: '兩隊 AI 辯論不同方法，由中立主席仲裁。',
  input_start_review: '開始審查 →',
  input_start_debate: '開始辯論 →',

  setup_mode_critique: '批判審查',
  setup_mode_critique_desc: '多視角評析，給出 Accept / Major / Minor / Reject 裁決。',
  setup_mode_gap: '缺口分析',
  setup_mode_gap_desc: '找出研究空白、缺漏元素與改進機會。',
  setup_rounds_label: '輪次',
  setup_rounds_1: '1 輪',
  setup_rounds_2: '2 輪',
  setup_launch: '啟動審查',
  setup_launching: '啟動中…',

  debate_option_a: '方案 A',
  debate_option_b: '方案 B',
  debate_context_label: '辯論背景',
  debate_context_placeholder: '辯論應聚焦於什麼？（選填）',
  debate_roles_label: '選擇角色（2–3 個）',
  debate_launch: '啟動辯論',
  debate_launching: '啟動中…',

  compare_title: '比較論文',
  compare_subtitle: '輸入 2–4 篇 arXiv ID，AI 將並排比較方法、貢獻與限制。',
  compare_add_paper: '新增論文',
  compare_run: '開始比較',
  compare_running: '比較中…',
  compare_new: '新比較',
  compare_verdict: '綜合裁決',

  status_concluded: '已完成',
  status_running: '進行中',
  status_pending: '排隊中',
  status_failed: '失敗',
  status_ready: '就緒',
  status_processing: '處理中',

  table_title: '標題',
  table_status: '狀態',
  table_when: '時間',
  table_paper: '論文',
  table_sessions: '工作階段',
  table_updated: '更新時間',
  table_topic: '主題',
  table_divergence: '分歧度',
  table_rounds: '輪次',
  table_dimension: '維度',

  action_new_review: '新增審查',
  action_view_all_reviews: '查看全部審查 →',
  action_delete: '刪除',
  action_retry: '重試',
  action_search_reviews: '搜尋審查…',
  action_search_papers: '搜尋論文或 arXiv ID',
  action_start_first: '開始第一個。',

  home_stat_total: '工作階段總數',
  home_stat_all_time: '全部時間',
  home_stat_this_week: '本週',
  home_stat_weekly_limit: '每週上限',
  home_stat_concluded: '已完成',
  home_stat_completed: '已結束',
  home_no_sessions: '今天還沒有工作階段',
  home_sessions_today: '個工作階段',
  home_upgrade_banner: '歡迎升級 Pro！您每天可進行 50 次審查。',

  page_papers: '論文庫',
  page_papers_subtitle: '已快取的論文及其關聯的審查階段',
  page_new_analysis: '新增分析',
  page_new_analysis_subtitle: '輸入 arXiv ID、網址，或上傳 PDF 以開始分析。',
  page_configure_review: '設定審查',
  page_configure_debate: '設定辯論',

  debate_positions_label: '立場',
  debate_side_a: '正方 — 支持',
  debate_side_b: '反方 — 反對',
  debate_side_a_placeholder: '例：研究方法合理',
  debate_side_b_placeholder: '例：研究結果被過度解讀',
  debate_context_optional_label: '辯論背景（選填）',
  debate_roles_selected: '專家角色',
  debate_error_sides: '正反方立場均為必填',
  debate_error_roles: '請至少選擇一個專家角色',

  common_loading: '載入中…',
  common_error: '發生錯誤。',
  common_back: '返回',
  common_cancel: '取消',
  common_save: '儲存',
  common_or: '或',
  common_search: '搜尋…',
  common_no_results: '找不到結果。',
}

const zhCN: UiMessages = {
  ...zhTW,
  nav_dashboard: '首页',
  nav_reviews: '审查记录',
  nav_papers: '论文库',
  nav_compare: '比较论文',
  nav_new_analysis: '新建分析',
  nav_sign_out: '退出',
  nav_free_plan: '免费套餐',
  home_greeting: '你好',
  home_subtitle: '上传论文或输入 arXiv ID 以开始分析。',
  home_domain_label: '研究领域',
  home_recent_reviews: '最近审查',
  domain_general: '通用',
  domain_materials: '材料科学',
  domain_biomedical: '生物医学',
  input_arxiv_placeholder: 'arXiv ID 或网址（例如 2401.00001）',
  input_pdf_placeholder: '拖放 PDF 到此处，或点击选择',
  input_confirm: '确认 — 开始分析',
  input_fetching: '获取中…',
  input_processing: '处理中…',
  input_mode_review: '审查论文',
  input_mode_review_desc: '5 位专业评审从多视角分析论文，给出结构化裁决。',
  input_mode_debate: '对抗辩论',
  input_mode_debate_desc: '两队 AI 辩论竞争方法，由中立主席仲裁。',
  input_start_review: '开始审查 →',
  input_start_debate: '开始辩论 →',
  setup_mode_critique: '批判审查',
  setup_mode_critique_desc: '多视角评析，给出 Accept / Major / Minor / Reject 裁决。',
  setup_mode_gap: '缺口分析',
  setup_mode_gap_desc: '识别研究空白、缺漏元素与改进机会。',
  setup_rounds_label: '轮次',
  setup_rounds_1: '1 轮',
  setup_rounds_2: '2 轮',
  setup_launch: '启动审查',
  setup_launching: '启动中…',
  debate_option_a: '方案 A',
  debate_option_b: '方案 B',
  debate_context_label: '辩论背景',
  debate_context_placeholder: '辩论应聚焦于什么？（选填）',
  debate_roles_label: '选择角色（2–3 个）',
  debate_launch: '启动辩论',
  debate_launching: '启动中…',
  compare_title: '比较论文',
  compare_subtitle: '输入 2–4 篇 arXiv ID，AI 将并排比较方法、贡献与局限。',
  compare_add_paper: '新增论文',
  compare_run: '开始比较',
  compare_running: '比较中…',
  compare_new: '新比较',
  compare_verdict: '综合裁决',
  page_papers: '论文库',
  page_papers_subtitle: '已缓存的论文及其关联的审查阶段',
  page_new_analysis: '新建分析',
  page_new_analysis_subtitle: '输入 arXiv ID、网址，或上传 PDF 以开始分析。',
  page_configure_review: '配置审查',
  page_configure_debate: '配置辩论',
  action_new_review: '新建审查',
  action_view_all_reviews: '查看全部审查 →',
  action_search_reviews: '搜索审查…',
  action_search_papers: '搜索论文或 arXiv ID',
  home_upgrade_banner: '欢迎升级 Pro！您每天可进行 50 次审查。',
  home_stat_total: '工作阶段总数',
  home_stat_this_week: '本周',
  home_stat_weekly_limit: '每周上限',
  home_stat_concluded: '已完成',
  home_stat_completed: '已结束',
  home_no_sessions: '今天还没有工作阶段',
  debate_positions_label: '立场',
  debate_side_a: '正方 — 支持',
  debate_side_b: '反方 — 反对',
  debate_side_a_placeholder: '例：研究方法合理',
  debate_side_b_placeholder: '例：研究结果被过度解读',
  debate_context_optional_label: '辩论背景（选填）',
  debate_roles_selected: '专家角色',
  debate_error_sides: '正反方立场均为必填',
  debate_error_roles: '请至少选择一个专家角色',
  common_loading: '加载中…',
  common_error: '出现错误。',
  common_back: '返回',
  common_cancel: '取消',
  common_save: '保存',
  common_search: '搜索…',
  common_no_results: '未找到结果。',
}

const ja: UiMessages = {
  nav_dashboard: 'ダッシュボード',
  nav_reviews: 'レビュー履歴',
  nav_papers: '論文ライブラリ',
  nav_compare: '論文比較',
  nav_api_keys: 'APIキー',
  nav_new_analysis: '新しい分析',
  nav_sign_out: 'サインアウト',
  nav_free_plan: '無料プラン',

  home_greeting: 'こんにちは',
  home_subtitle: '論文をアップロードするか、arXiv IDを入力して分析を開始してください。',
  home_domain_label: '研究分野',
  home_recent_reviews: '最近のレビュー',
  home_stats_sessions: 'セッション',
  home_stats_papers: '論文',

  domain_general: '一般',
  domain_materials: '材料科学',
  domain_biomedical: '生物医学',
  domain_physics: '物理学',

  input_arxiv_placeholder: 'arXiv IDまたはURL（例: 2401.00001）',
  input_pdf_placeholder: 'PDFをここにドロップ、またはクリックして選択',
  input_fetch_preview: 'プレビュー',
  input_upload_pdf: 'PDFをアップロード',
  input_confirm: '確認 — 分析を開始',
  input_reset: 'リセット',
  input_fetching: '取得中…',
  input_processing: '処理中…',
  input_mode_review: '論文レビュー',
  input_mode_review_desc: '5名の専門家が論文を評価し、構造化された評決を提供します。',
  input_mode_debate: '対立討論',
  input_mode_debate_desc: '2チームのAIが競合アプローチを討論し、中立な司会者が仲裁します。',
  input_start_review: 'レビュー開始 →',
  input_start_debate: '討論開始 →',

  setup_mode_critique: '批判的レビュー',
  setup_mode_critique_desc: '多角的な視点でレビューし、Accept/Major/Minor/Rejectの評決を下します。',
  setup_mode_gap: 'ギャップ分析',
  setup_mode_gap_desc: '研究のギャップ、欠落している要素、改善の機会を特定します。',
  setup_rounds_label: 'ラウンド',
  setup_rounds_1: '1ラウンド',
  setup_rounds_2: '2ラウンド',
  setup_launch: 'レビュー開始',
  setup_launching: '起動中…',

  debate_option_a: 'オプションA',
  debate_option_b: 'オプションB',
  debate_context_label: 'コンテキスト',
  debate_context_placeholder: '討論の焦点は？（任意）',
  debate_roles_label: '役割を選択（2〜3個）',
  debate_launch: '討論開始',
  debate_launching: '起動中…',

  compare_title: '論文比較',
  compare_subtitle: '2〜4件のarXiv IDを入力してください。AIが方法論、貢献、限界を並べて比較します。',
  compare_add_paper: '論文を追加',
  compare_run: '比較',
  compare_running: '比較中…',
  compare_new: '新しい比較',
  compare_verdict: '総合評価',

  status_concluded: '完了',
  status_running: '実行中',
  status_pending: '待機中',
  status_failed: '失敗',
  status_ready: '準備完了',
  status_processing: '処理中',
  table_title: 'タイトル',
  table_status: 'ステータス',
  table_when: '日時',
  table_paper: '論文',
  table_sessions: 'セッション',
  table_updated: '更新日',
  table_topic: 'トピック',
  table_divergence: '乖離度',
  table_rounds: 'ラウンド',
  table_dimension: '次元',
  action_new_review: '新しいレビュー',
  action_view_all_reviews: 'すべてのレビューを表示 →',
  action_delete: '削除',
  action_retry: '再試行',
  action_search_reviews: 'レビューを検索…',
  action_search_papers: '論文またはarXiv IDを検索',
  action_start_first: '最初のレビューを始めましょう。',
  home_stat_total: '総セッション数',
  home_stat_all_time: '全期間',
  home_stat_this_week: '今週',
  home_stat_weekly_limit: '週間制限',
  home_stat_concluded: '完了',
  home_stat_completed: '完了済み',
  home_no_sessions: '今日はまだセッションがありません',
  home_sessions_today: 'セッション',
  home_upgrade_banner: 'Proへようこそ！1日50回のレビューが可能です。',
  page_papers: '論文ライブラリ',
  page_papers_subtitle: 'キャッシュされた論文とそのレビューセッション',
  page_new_analysis: '新しい分析',
  page_new_analysis_subtitle: 'arXiv IDまたはURLを入力するか、PDFをアップロードしてください。',
  page_configure_review: 'レビュー設定',
  page_configure_debate: '討論設定',
  debate_positions_label: 'ポジション',
  debate_side_a: '賛成側',
  debate_side_b: '反対側',
  debate_side_a_placeholder: '例：この手法は合理的です',
  debate_side_b_placeholder: '例：結果は誇張されています',
  debate_context_optional_label: 'コンテキスト（任意）',
  debate_roles_selected: '専門家の役割',
  debate_error_sides: '両サイドの入力が必要です',
  debate_error_roles: '少なくとも1つの役割を選択してください',
  common_loading: '読み込み中…',
  common_error: 'エラーが発生しました。',
  common_back: '戻る',
  common_cancel: 'キャンセル',
  common_save: '保存',
  common_or: 'または',
  common_search: '検索…',
  common_no_results: '結果が見つかりません。',
}

const ko: UiMessages = {
  nav_dashboard: '대시보드',
  nav_reviews: '리뷰 기록',
  nav_papers: '논문 라이브러리',
  nav_compare: '논문 비교',
  nav_api_keys: 'API 키',
  nav_new_analysis: '새 분석',
  nav_sign_out: '로그아웃',
  nav_free_plan: '무료 플랜',

  home_greeting: '안녕하세요',
  home_subtitle: '논문을 업로드하거나 arXiv ID를 입력하여 분석을 시작하세요.',
  home_domain_label: '연구 분야',
  home_recent_reviews: '최근 리뷰',
  home_stats_sessions: '세션',
  home_stats_papers: '논문',

  domain_general: '일반',
  domain_materials: '재료 과학',
  domain_biomedical: '생물의학',
  domain_physics: '물리학',

  input_arxiv_placeholder: 'arXiv ID 또는 URL (예: 2401.00001)',
  input_pdf_placeholder: 'PDF를 여기에 드롭하거나 클릭하여 선택',
  input_fetch_preview: '미리보기',
  input_upload_pdf: 'PDF 업로드',
  input_confirm: '확인 — 분석 시작',
  input_reset: '초기화',
  input_fetching: '가져오는 중…',
  input_processing: '처리 중…',
  input_mode_review: '논문 리뷰',
  input_mode_review_desc: '5명의 전문 리뷰어가 논문을 평가하고 구조화된 평결을 제공합니다.',
  input_mode_debate: '대립 토론',
  input_mode_debate_desc: '두 AI 팀이 경쟁적 접근 방식을 토론하고 중립적인 사회자가 중재합니다.',
  input_start_review: '리뷰 시작 →',
  input_start_debate: '토론 시작 →',

  setup_mode_critique: '비판적 리뷰',
  setup_mode_critique_desc: '다각적 관점에서 리뷰하여 Accept/Major/Minor/Reject 평결을 제공합니다.',
  setup_mode_gap: '갭 분석',
  setup_mode_gap_desc: '연구 공백, 누락된 요소 및 개선 기회를 파악합니다.',
  setup_rounds_label: '라운드',
  setup_rounds_1: '1라운드',
  setup_rounds_2: '2라운드',
  setup_launch: '리뷰 시작',
  setup_launching: '시작 중…',

  debate_option_a: '옵션 A',
  debate_option_b: '옵션 B',
  debate_context_label: '맥락',
  debate_context_placeholder: '토론의 초점은? (선택 사항)',
  debate_roles_label: '역할 선택 (2-3개)',
  debate_launch: '토론 시작',
  debate_launching: '시작 중…',

  compare_title: '논문 비교',
  compare_subtitle: '2-4개의 arXiv ID를 입력하세요. AI가 방법론, 기여도, 한계를 나란히 비교합니다.',
  compare_add_paper: '논문 추가',
  compare_run: '비교',
  compare_running: '비교 중…',
  compare_new: '새 비교',
  compare_verdict: '종합 평결',

  status_concluded: '완료',
  status_running: '실행 중',
  status_pending: '대기 중',
  status_failed: '실패',
  status_ready: '준비 완료',
  status_processing: '처리 중',
  table_title: '제목',
  table_status: '상태',
  table_when: '시간',
  table_paper: '논문',
  table_sessions: '세션',
  table_updated: '업데이트',
  table_topic: '주제',
  table_divergence: '분기도',
  table_rounds: '라운드',
  table_dimension: '차원',
  action_new_review: '새 리뷰',
  action_view_all_reviews: '모든 리뷰 보기 →',
  action_delete: '삭제',
  action_retry: '재시도',
  action_search_reviews: '리뷰 검색…',
  action_search_papers: '논문 또는 arXiv ID 검색',
  action_start_first: '첫 번째를 시작하세요.',
  home_stat_total: '총 세션 수',
  home_stat_all_time: '전체 기간',
  home_stat_this_week: '이번 주',
  home_stat_weekly_limit: '주간 한도',
  home_stat_concluded: '완료',
  home_stat_completed: '완료됨',
  home_no_sessions: '오늘 아직 세션이 없습니다',
  home_sessions_today: '세션',
  home_upgrade_banner: 'Pro에 오신 것을 환영합니다! 하루 50번 리뷰가 가능합니다.',
  page_papers: '논문 라이브러리',
  page_papers_subtitle: '캐시된 논문 및 관련 리뷰 세션',
  page_new_analysis: '새 분석',
  page_new_analysis_subtitle: 'arXiv ID, URL을 입력하거나 PDF를 업로드하세요.',
  page_configure_review: '리뷰 설정',
  page_configure_debate: '토론 설정',
  debate_positions_label: '입장',
  debate_side_a: '찬성 측',
  debate_side_b: '반대 측',
  debate_side_a_placeholder: '예: 이 방법론은 타당합니다',
  debate_side_b_placeholder: '예: 결과가 과장되었습니다',
  debate_context_optional_label: '맥락 (선택 사항)',
  debate_roles_selected: '전문가 역할',
  debate_error_sides: '양측 입장 모두 필수입니다',
  debate_error_roles: '최소 하나의 전문가 역할을 선택하세요',
  common_loading: '로딩 중…',
  common_error: '오류가 발생했습니다.',
  common_back: '뒤로',
  common_cancel: '취소',
  common_save: '저장',
  common_or: '또는',
  common_search: '검색…',
  common_no_results: '결과가 없습니다.',
}

const TRANSLATIONS: Record<SupportedLocale, UiMessages> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko }

export function getTranslations(locale: string): UiMessages {
  const key = locale as SupportedLocale
  return TRANSLATIONS[key] ?? TRANSLATIONS.en
}
