# FLOW_1：.opencode 需求分析開發流程

這份文件說明目前 `.opencode` 自訂流程。這套流程不是直接寫程式碼，而是把使用者提出的需求先整理成可落地的需求分析文件，讓後續開發、測試與專案管理可以依同一份 Markdown 需求文件工作。

## 核心目的

- 先判斷本次需求是否和既有需求文件相關。
- 不管是否找到既有文件，都必須先進行互動式需求澄清。
- 澄清完成後，一定產出或更新 `.opencode/outputs/analyze-requirements` 內的 Markdown 需求分析文件。
- 同步維護 `requirement-repo-map.md`，讓下一次需求可以更快搜尋與比對。

## 主要元件

| 類型 | 檔案 | 角色 |
| --- | --- | --- |
| 入口代理 | `.opencode/agents/find-requirements-doc.md` | 固定流程入口：先搜尋、再澄清、最後產檔 |
| 澄清代理 | `.opencode/agents/requirements-clarify.md` | 用複選題確認需求範圍、新舊需求關係與版本決策 |
| 產檔代理 | `.opencode/agents/analyze-requirements.md` | 只接受澄清後欄位，呼叫產檔工具 |
| 搜尋工具 | `.opencode/tools/find-requirements-doc.ts` | 搜尋既有需求 Markdown，判斷候選是否明確 |
| 產檔工具 | `.opencode/tools/analyze-requirements.ts` | 建立新需求文件或迭代更新舊需求文件 |
| 索引工具 | `.opencode/tools/rebuild-requirement-repo-map.ts` | 從既有 Markdown 重建 repo map |
| 共用函式 | `.opencode/lib/requirement-docs.ts` | 管理輸出目錄、文件清單、repo map 讀寫 |

## 流程圖

```mermaid
flowchart TD
    A["使用者提出需求"] --> B["入口代理：find-requirements-doc"]
    B --> C["工具：find-requirements-doc.ts"]
    C --> D{是否找到相關需求文件？}

    D -->|"沒有候選"| E["全新需求分支"]
    D -->|"明確候選"| F["迭代既有需求分支"]
    D -->|"候選不明確"| G["候選確認模式"]

    G --> H["question：選舊檔、繼續搜尋或改全新需求"]
    H --> I["確定澄清上下文"]

    E --> J["澄清代理：requirements-clarify"]
    F --> J
    I --> J

    J --> K["question：複選澄清需求、範圍、FE/BE/Test、版本決策"]
    K --> L{澄清是否完成？}
    L -->|"否"| K
    L -->|"是"| M["輸出 clarificationComplete + runAnalyze + analyzeArgs"]

    M --> N["產檔代理：analyze-requirements"]
    N --> O["工具：analyze-requirements.ts"]
    O --> P{產檔意圖是否合法？}

    P -->|"不合法"| Q["回到澄清或回報 gate 錯誤"]
    Q --> J

    P -->|"合法：new/create_new"| R["建立新的需求 Markdown"]
    P -->|"合法：related/use_new 或 merge"| S["更新既有需求 Markdown"]

    R --> T["更新 requirement-repo-map.md"]
    S --> U{舊檔是否超過壓縮門檻？}
    U -->|"否"| T
    U -->|"是"| V["封存完整歷史到 .history.md"]
    V --> T

    T --> W["回傳最後一次 analyze-requirements 工具輸出"]
```

## 架構圖

```mermaid
flowchart LR
    subgraph User["使用者互動層"]
        U1["原始需求"]
        U2["question 複選回答"]
    end

    subgraph Agents[".opencode/agents"]
        A1["find-requirements-doc.md<br/>入口與流程編排"]
        A2["requirements-clarify.md<br/>需求澄清 gate"]
        A3["analyze-requirements.md<br/>產檔 gate"]
    end

    subgraph Tools[".opencode/tools"]
        T1["find-requirements-doc.ts<br/>候選需求搜尋"]
        T2["analyze-requirements.ts<br/>產生 / 更新需求文件"]
        T3["list-requirement-docs.ts<br/>列出需求文件"]
        T4["rebuild-requirement-repo-map.ts<br/>重建索引"]
    end

    subgraph Lib[".opencode/lib"]
        L1["requirement-docs.ts<br/>路徑、清單、repo map 共用邏輯"]
    end

    subgraph Storage["需求文件儲存層"]
        S1[".opencode/outputs/analyze-requirements/*.md"]
        S2["requirement-repo-map.md"]
        S3["*.history.md"]
    end

    U1 --> A1
    A1 --> T1
    T1 --> L1
    L1 --> S1
    L1 --> S2

    A1 --> A2
    A2 --> U2
    U2 --> A2
    A2 --> A1

    A1 --> A3
    A3 --> T2
    T2 --> L1
    T2 --> S1
    T2 --> S2
    T2 --> S3

    T3 --> L1
    T4 --> L1
    T4 --> S2
```

## 關鍵規則

### 1. `requirements-clarify` 是必經 gate

搜尋結果不能直接拿來產檔。即使找到明確候選文件，也必須先呼叫 `requirements-clarify`，讓使用者透過 `question` 複選題確認需求理解、開發範圍與版本決策。

### 2. 產檔是澄清後的固定下一步

`requirements-clarify` 完成後必須輸出：

```json
{
  "clarificationComplete": true,
  "runAnalyze": true,
  "analyzeArgs": {}
}
```

入口代理收到合法 `analyzeArgs` 後，下一步只能呼叫 `analyze-requirements`，不可停在摘要、建議或版本確認文字。

### 3. 全新需求與迭代需求的決策不同

全新需求必須符合：

- `relation=new`
- `compatibility=compatible`
- `versionDecision=create_new`
- 不傳 `targetFileName`

迭代既有需求必須符合：

- `relation=related`
- `candidateFileName=<既有需求檔名>`
- `targetFileName=<同一個既有需求檔名>`
- `compatibility=compatible`
- `versionDecision=use_new` 或 `merge`
- `conflictResolution` 具體包含「保留舊需求」、「新版變更」、「不衝突原因」

### 4. 不可用未決策狀態結束流程

以下狀態只能作為澄清過程中的暫態，不可作為最終產檔輸入：

- `relation=uncertain`
- `compatibility=conflict`
- `compatibility=needs_decision`
- `versionDecision=keep_old`
- `versionDecision=needs_decision`

遇到這些狀態時，必須回到 `requirements-clarify` 或確認模式，繼續用 `question` 取得可產檔決策。

## 輸出結果

成功產檔後會產生或更新：

- 需求 Markdown：`.opencode/outputs/analyze-requirements/analyze-requirements_<uuid>_<timestamp>.md`
- 索引文件：`.opencode/outputs/analyze-requirements/requirement-repo-map.md`
- 歷史封存：舊需求檔過長時，完整歷史會封存到同目錄的 `*.history.md`

## 流程摘要

```text
使用者需求
  -> 搜尋既有需求文件
  -> 判斷全新 / 明確候選 / 候選不明確
  -> 必經複選澄清
  -> 輸出結構化 analyzeArgs
  -> gate 檢查新舊需求與版本決策
  -> 建新檔或更新舊檔
  -> 更新 requirement-repo-map.md
```
