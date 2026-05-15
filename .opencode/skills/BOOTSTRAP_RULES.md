# Skill Bootstrap Rules

本檔定義 `.opencode/skills/` 目錄下所有 skill 的共通 bootstrap 解讀規則。

## 全域硬規則

- 凡任一 skill 內出現 `bootstrap`、`initialization`、`setup`、`installation`、`integration`、`verification`、`startup contract`、`baseline wiring`、`dependency installation`、`scaffold`、`entrypoint`、`package scripts`、`runtime config`、`framework/plugin wiring` 等要求，只要目標 repo 尚未存在對應檔案與可沿用契約，一律視為啟動階段硬要求。
- 這些要求必須在 bootstrap 階段落地，不得延後到 feature implementation、styling pass、testing pass、integration pass 或 post-bootstrap cleanup。
- 禁止把上述要求標記為 `optional`、`deferred`、`pending`、`placeholder`、`later`、`future work`、`follow-up` 或其他等價的延後語意。
- 唯一例外是目標 repo 原本已存在對應檔案、設定、lockfile、scripts、entrypoint 與可運作契約；此時應優先沿用既有專案，而不是強制重建。
- 即使存在既有檔案，只要現況缺漏已使專案不符合該 skill 的硬性契約，仍必須在 bootstrap 階段補齊，不得因為「已有部分檔案」而跳過。

## 執行原則

- 先檢查現況，再判斷是沿用既有契約還是完整 bootstrap。
- 若 repo 不存在可沿用基底，skill 內 baseline 與驗證要求必須一併落地，不能只建立空殼專案。
- 若同時觸發多個 skill，所有被觸發 skill 的 bootstrap 條款都必須一起滿足；不得只完成其中一部分就宣稱 bootstrap 完成。
