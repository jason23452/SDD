 
 
 
 
 
flowchart TD
    U[使用者提出需求] --> F[find-requirements-doc<br/>(第一步)]

    %% 指定要搜尋的 repo 位置
    F --> R[(repo: .opencode\outputs\analyze-requirements)]
    R --> F

    F --> Q{是否找到相關需求文件?}

    %% 流程1：已找到既有文件
    Q -->|有文件| D[讀取既有需求文件]
    D --> C1[requirements-clarify<br/>根據既有文件與使用者需求進行釐清]
    C1 --> A1[analyze-requirements<br/>補充/更新既有需求文件]
    A1 --> O1[產生更新後需求文件<br/>包含 updated_date 與 run_id]

    %% 流程2：找不到文件
    Q -->|沒有文件| C2[requirements-clarify<br/>釐清使用者需求]
    C2 --> A2[analyze-requirements<br/>產生全新需求文件]
    A2 --> O2[產生全新需求文件<br/>包含 created_date、updated_date 與 run_id]
