# qutebrowser preflight (SWE-bench Pro)
Source: `ScaleAI/SWE-bench_Pro` public split filtered to `qutebrowser/qutebrowser`, plus a local clone of `qutebrowser/qutebrowser`.
## Task count and patch shape
- Tasks: **79**
- Patch files/task: {'min': 1, 'median': 3, 'mean': 2.84, 'max': 7}
- Patch churn lines: {'min': 22, 'median': 52, 'mean': 79.35, 'max': 560}
## Base commit dates
- 2019: 10
- 2020: 15
- 2021: 23
- 2022: 12
- 2023: 17
- 2024: 2

Cutoff availability:
- evaluate tasks with base_commit >= 2019-01-01: 79
- evaluate tasks with base_commit >= 2020-01-01: 69
- evaluate tasks with base_commit >= 2021-01-01: 54
- evaluate tasks with base_commit >= 2022-01-01: 31
- evaluate tasks with base_commit >= 2023-01-01: 19

## Top patch subsystems
- 33: `qutebrowser/config`
- 27: `doc`
- 26: `qutebrowser/browser`
- 24: `qutebrowser/utils`
- 17: `qutebrowser/misc`
- 7: `qutebrowser/components`
- 7: `scripts`
- 6: `qutebrowser/mainwindow`
- 4: `qutebrowser/app.py`
- 4: `qutebrowser/completion`
- 3: `qutebrowser/keyinput`
- 2: `qutebrowser/qutebrowser.py`
- 2: `qutebrowser/qt`
- 1: `qutebrowser/commands`
- 1: `misc`
- 1: `pytest.ini`
- 1: `qutebrowser/javascript`

## Top patch files
- 20: `qutebrowser/config/configdata.yml`
- 19: `doc/changelog.asciidoc`
- 16: `doc/help/settings.asciidoc`
- 10: `qutebrowser/config/qtargs.py`
- 8: `qutebrowser/utils/utils.py`
- 6: `qutebrowser/config/configtypes.py`
- 6: `qutebrowser/utils/qtutils.py`
- 5: `doc/help/commands.asciidoc`
- 5: `qutebrowser/misc/guiprocess.py`
- 5: `qutebrowser/browser/webengine/darkmode.py`
- 5: `qutebrowser/browser/webengine/webview.py`
- 4: `qutebrowser/config/configutils.py`
- 4: `qutebrowser/utils/urlutils.py`
- 4: `qutebrowser/app.py`
- 4: `qutebrowser/config/configfiles.py`
- 4: `qutebrowser/misc/utilcmds.py`
- 4: `qutebrowser/utils/version.py`
- 4: `qutebrowser/browser/shared.py`
- 3: `qutebrowser/browser/commands.py`
- 3: `qutebrowser/completion/models/miscmodels.py`

## History / rationale density
- Total commits parsed: 25833
- Commits with body: 7034 (27.2%)
- Long body (>=20 words): 2326 (9.0%)
- Rationale-keyword commits: 3000 (11.6%)

Focused subsystem history density:
- `qutebrowser/config`: 839 commits touching path; 228 rationale-keyword (27.2%)
- `doc`: 688 commits touching path; 141 rationale-keyword (20.5%)
- `qutebrowser/browser`: 1599 commits touching path; 457 rationale-keyword (28.6%)
- `qutebrowser/utils`: 612 commits touching path; 192 rationale-keyword (31.4%)
- `qutebrowser/misc`: 543 commits touching path; 181 rationale-keyword (33.3%)
- `qutebrowser/components`: 57 commits touching path; 10 rationale-keyword (17.5%)
- `scripts`: 567 commits touching path; 179 rationale-keyword (31.6%)
- `qutebrowser/mainwindow`: 402 commits touching path; 121 rationale-keyword (30.1%)
- `qutebrowser/app.py`: 229 commits touching path; 76 rationale-keyword (33.2%)
- `qutebrowser/completion`: 302 commits touching path; 95 rationale-keyword (31.5%)

## Sample tasks (first 25 by instance_id)

### instance_qutebrowser__qutebrowser-01d1d1494411380d97cac14614a829d3a69cecaf-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2020-12-19)
- subsystems: qutebrowser/components, qutebrowser/utils
- files: qutebrowser/components/braveadblock.py, qutebrowser/utils/version.py
- preview: "## Title:\n\nUnreliable behavior in version reporting and blocklist download notifications\n\n#### Description:\n\nThe system shows inconsistent behavior when reporting installed module versions and when signaling the completion of blockli

### instance_qutebrowser__qutebrowser-0833b5f6f140d04200ec91605f88704dd18e2970-v059c6fdc75567943479b23ebca7c07b5e9a7f34c (2022-08-23)
- subsystems: qutebrowser/browser, qutebrowser/misc
- files: qutebrowser/browser/qtnetworkdownloads.py, qutebrowser/browser/webkit/network/networkreply.py, qutebrowser/misc/ipc.py
- preview: ## Title: Error signal in WebKit `NetworkReply` uses deprecated `error` instead of `errorOccurred`.   ### Description  In the WebKit backend, the `NetworkReply` implementation still emits the legacy `error` signal when an error reply is con

### instance_qutebrowser__qutebrowser-0aa57e4f7243024fa4bba8853306691b5dbd77b3-v5149fcda2a9a6fe1d35dfed1bade1444a11ef271 (2023-12-04)
- subsystems: doc, qutebrowser/browser, qutebrowser/config
- files: doc/help/settings.asciidoc, qutebrowser/browser/webengine/darkmode.py, qutebrowser/config/configdata.yml
- preview: ## Title:  QtWebEngine ≥ 6.4: Dark mode brightness threshold for foreground is not applied or can't be set correctly  ## Description:  In QtWebEngine 6.4 and higher, Chromium changed the internal key for the dark mode brightness threshold f

### instance_qutebrowser__qutebrowser-0b621cb0ce2b54d3f93d8d41d8ff4257888a87e5-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2021-03-15)
- subsystems: qutebrowser/misc
- files: qutebrowser/misc/guiprocess.py
- preview: # Process startup error message omits command name  ## Description   When starting a process fails, the error message doesn’t include the command that was used. As a result, it is unclear which command caused the failure the configured uplo

### instance_qutebrowser__qutebrowser-0d2afd58f3d0e34af21cee7d8a3fc9d855594e9f-vnan (2023-08-15)
- subsystems: qutebrowser/app.py, qutebrowser/browser, qutebrowser/keyinput, qutebrowser/utils
- files: qutebrowser/app.py, qutebrowser/browser/eventfilter.py, qutebrowser/keyinput/modeman.py, qutebrowser/utils/qtutils.py
- preview: "# Title : Need better `QObject` representation for debugging\n\n## Description  \n\nWhen debugging issues related to `QObject`s, the current representation in logs and debug output is not informative enough. Messages often show only a memo

### instance_qutebrowser__qutebrowser-0fc6d1109d041c69a68a896db87cf1b8c194cef7-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2021-01-19)
- subsystems: doc, qutebrowser/completion, qutebrowser/config
- files: doc/help/settings.asciidoc, qutebrowser/completion/models/filepathcategory.py, qutebrowser/completion/models/urlmodel.py, qutebrowser/config/configdata.yml
- preview: "# Add filesystem path completion support for `:open` command\n\n## Description.\n\nCurrently, the `:open` command in `qutebrowser` only provides completion for web-related categories such as search engines, quickmarks, bookmarks, and histo

### instance_qutebrowser__qutebrowser-16de05407111ddd82fa12e54389d532362489da9-v363c8a7e5ccdf6968fc7ab84a2053ac78036691d (2021-03-10)
- subsystems: doc, qutebrowser/config
- files: doc/changelog.asciidoc, doc/help/settings.asciidoc, qutebrowser/config/configdata.yml, qutebrowser/config/qtargs.py
- preview: "# QtWebEngine 5.15.3 causes blank page and network service crashes for certain locales. \n\n## Description. \nOn Linux systems using QtWebEngine 5.15.3, qutebrowser may fail to start properly when the QtWebEngine locale files do not fully 

### instance_qutebrowser__qutebrowser-1943fa072ec3df5a87e18a23b0916f134c131016-vafb3e8e01b31319c66c4e666b8a3b1d8ba55db24 (2020-09-14)
- subsystems: qutebrowser/browser, qutebrowser/mainwindow, qutebrowser/misc
- files: qutebrowser/browser/browsertab.py, qutebrowser/browser/commands.py, qutebrowser/mainwindow/tabbedbrowser.py, qutebrowser/mainwindow/tabwidget.py, qutebrowser/misc/sessions.py
- preview: # Handle tab pinned status in AbstractTab  **Description** When a tab is closed and then restored under a different window context, such as after setting `tabs.tabs_are_windows` to `true` and using `:undo`, the restored tab may no longer be

### instance_qutebrowser__qutebrowser-1a9e74bfaf9a9db2a510dc14572d33ded6040a57-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2020-07-10)
- subsystems: qutebrowser/config
- files: qutebrowser/config/qtargs.py
- preview: "## Title: Qt args don’t combine existing `--enable-features` flags\n\n### Description:\n\nWhen qutebrowser is started with an existing `--enable-features` flag and qutebrowser also adds its own feature flags for QtWebEngine, the flags are 

### instance_qutebrowser__qutebrowser-1af602b258b97aaba69d2585ed499d95e2303ac2-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2022-03-31)
- subsystems: doc, qutebrowser/components
- files: doc/changelog.asciidoc, qutebrowser/components/readlinecommands.py
- preview: # ‘:rl-rubout’ and ‘:rl-filename-rubout’ fail to delete the first character if input does not start with a delimiter   ## Description:  When using the ‘:rl-rubout’ or ‘:rl-filename-rubout’ commands in qutebrowser's readline interface, if th

### instance_qutebrowser__qutebrowser-21b426b6a20ec1cc5ecad770730641750699757b-v363c8a7e5ccdf6968fc7ab84a2053ac78036691d (2019-11-27)
- subsystems: qutebrowser/config, scripts
- files: qutebrowser/config/configutils.py, scripts/dev/run_vulture.py
- preview: ## Title Iteration and representation of configuration values do not correctly handle scoped patterns.  ### Description The `Values` class continues to manage `ScopedValue` entries with a simple list, which creates inconsistencies when repr

### instance_qutebrowser__qutebrowser-233cb1cc48635130e5602549856a6fa4ab4c087f-v35616345bb8052ea303186706cec663146f0f184 (2020-06-18)
- subsystems: doc, pytest.ini, qutebrowser/browser, qutebrowser/config
- files: doc/changelog.asciidoc, doc/help/settings.asciidoc, pytest.ini, qutebrowser/browser/shared.py, qutebrowser/config/configdata.yml, qutebrowser/config/configfiles.py, qutebrowser/config/configinit.py
- preview: "# Title: Add `overlay` option for `scrolling.bar` and gate it by platform/Qt\n\n## Description:\n\nThe configuration key `scrolling.bar` lacks an `overlay` option to enable overlay scrollbars on supported environments. Introduce `overlay` 

### instance_qutebrowser__qutebrowser-2dd8966fdcf11972062c540b7a787e4d0de8d372-v363c8a7e5ccdf6968fc7ab84a2053ac78036691d (2019-05-14)
- subsystems: qutebrowser/browser, qutebrowser/config, qutebrowser/mainwindow, qutebrowser/utils
- files: qutebrowser/browser/webkit/webview.py, qutebrowser/config/configdata.yml, qutebrowser/mainwindow/tabwidget.py, qutebrowser/utils/jinja.py, qutebrowser/utils/qtutils.py
- preview: # Need utility function to convert QColor objects to QSS-compatible color strings  ## Description  The application needs a way to convert Qt QColor objects into RGBA string format that can be used in Qt Style Sheets (QSS). Currently there's

### instance_qutebrowser__qutebrowser-2e961080a85d660148937ee8f0f6b3445a8f2c01-v363c8a7e5ccdf6968fc7ab84a2053ac78036691d (2023-09-23)
- subsystems: doc, qutebrowser/config
- files: doc/help/settings.asciidoc, qutebrowser/config/configdata.yml, qutebrowser/config/qtargs.py
- preview: ## Title: Inconsistent handling of `qt.workarounds.disable_accelerated_2d_canvas` option across versions.  ### Description: The function responsible for building QtWebEngine arguments currently treats the `qt.workarounds.disable_accelerated

### instance_qutebrowser__qutebrowser-305e7c96d5e2fdb3b248b27dfb21042fb2b7e0b8-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2020-05-15)
- subsystems: doc, qutebrowser/browser, qutebrowser/completion
- files: doc/changelog.asciidoc, qutebrowser/browser/commands.py, qutebrowser/completion/models/miscmodels.py
- preview: ## Title: Add tab completion for `:tab-focus` command in the current window  ### Description: The `:tab-focus` command switches focus to a tab by index or keyword (`last`, `stack-next`, `stack-prev`). Unlike other tab commands (e.g., `:buff

### instance_qutebrowser__qutebrowser-322834d0e6bf17e5661145c9f085b41215c280e8-v488d33dd1b2540b234cbb0468af6b6614941ce8f (2023-06-13)
- subsystems: qutebrowser/misc, qutebrowser/qt, qutebrowser/qutebrowser.py
- files: qutebrowser/misc/earlyinit.py, qutebrowser/qt/machinery.py, qutebrowser/qutebrowser.py
- preview: ## Title  Improve Qt wrapper error handling and early initialization  ### Description  qutebrowser’s Qt wrapper initialization and error reporting make troubleshooting harder than it needs to be. Wrapper selection happens late, and when no 

### instance_qutebrowser__qutebrowser-34a13afd36b5e529d553892b1cd8b9d5ce8881c4-vafb3e8e01b31319c66c4e666b8a3b1d8ba55db24 (2021-02-10)
- subsystems: qutebrowser/misc
- files: qutebrowser/misc/elf.py
- preview: # Title  Make ELF parser handle file read and seek errors more safely  ## Description  The ELF parser needs to be more safe when reading or seeking in the file. Right now, some file operations can raise errors that are not handled, and ther

### instance_qutebrowser__qutebrowser-35168ade46184d7e5b91dfa04ca42fe2abd82717-v363c8a7e5ccdf6968fc7ab84a2053ac78036691d (2019-08-17)
- subsystems: qutebrowser/config, qutebrowser/utils
- files: qutebrowser/config/config.py, qutebrowser/utils/jinja.py
- preview: **Title:** Inability to identify configuration dependencies in stylesheet templates  **Description:**  The system currently lacks the ability to statically analyze Jinja2 stylesheet templates to identify which specific configuration variabl

### instance_qutebrowser__qutebrowser-36ade4bba504eb96f05d32ceab9972df7eb17bcc-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2021-01-16)
- subsystems: qutebrowser/config
- files: qutebrowser/config/qtargs.py
- preview: # Missing support for disabling features with --disable-features in Qt arguments.  ## Description  When launching qutebrowser today, only activation flags (--enable-features) are recognized and there is no equivalent mechanism to disable fe

### instance_qutebrowser__qutebrowser-394bfaed6544c952c6b3463751abab3176ad4997-vafb3e8e01b31319c66c4e666b8a3b1d8ba55db24 (2021-02-10)
- subsystems: qutebrowser/browser, qutebrowser/config, qutebrowser/misc, qutebrowser/utils, scripts
- files: qutebrowser/browser/webengine/darkmode.py, qutebrowser/config/websettings.py, qutebrowser/misc/elf.py, qutebrowser/utils/utils.py, qutebrowser/utils/version.py, scripts/dev/run_vulture.py
- preview: "## Title\nRefactor QtWebEngine version detection to use multiple sources including ELF parsing\n\n## Description\nRight now, the way qutebrowser gets the QtWebEngine version is mostly by checking `PYQT_WEBENGINE_VERSION`. This can be unrel

### instance_qutebrowser__qutebrowser-3d01c201b8aa54dd71d4f801b1dd12feb4c0a08a-v5fc38aaf22415ab0b70567368332beee7955b367 (2021-03-09)
- subsystems: qutebrowser/app.py, qutebrowser/utils, scripts
- files: qutebrowser/app.py, qutebrowser/utils/resources.py, scripts/dev/check_coverage.py
- preview: # Title: Incorrect globbing and caching behavior in `qutebrowser.utils.resources`  ## Description  The resource handling logic in `qutebrowser.utils.resources` does not behave consistently and lacks direct test coverage. In particular, reso

### instance_qutebrowser__qutebrowser-3e21c8214a998cb1058defd15aabb24617a76402-v5fc38aaf22415ab0b70567368332beee7955b367 (2022-08-23)
- subsystems: qutebrowser/keyinput
- files: qutebrowser/keyinput/keyutils.py
- preview: **KeySequence Type Safety and Qt6 Compatibility Issues**  **Description**  The current `KeySequence` implementation in qutebrowser uses raw integer values to represent key combinations, which creates several problems:  1. **Type Safety Issu

### instance_qutebrowser__qutebrowser-3fd8e12949b8feda401930574facf09dd4180bba (2023-08-15)
- subsystems: doc, qutebrowser/browser, qutebrowser/components, qutebrowser/mainwindow, qutebrowser/misc, scripts
- files: doc/help/commands.asciidoc, qutebrowser/browser/hints.py, qutebrowser/components/scrollcommands.py, qutebrowser/mainwindow/statusbar/command.py, qutebrowser/misc/utilcmds.py, scripts/dev/build_release.py
- preview: # Standardize command naming with consistent cmd- prefix  ## Description  Commands related to command line operations currently use inconsistent naming patterns. Commands like `set-cmd-text`, `repeat`, `later`, `edit-command`, and `run-with

### instance_qutebrowser__qutebrowser-44e64199ed38003253f0296badd4a447645067b6-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2021-03-11)
- subsystems: qutebrowser/utils
- files: qutebrowser/utils/version.py
- preview: **Title:** Refactor `PyQtWebEngine` Version Detection Logic  **Description**  It would be helpful to refactor the current PyQtWebEngine version detection logic by splitting it into separate methods based on the source of the version informa

### instance_qutebrowser__qutebrowser-46e6839e21d9ff72abb6c5d49d5abaa5a8da8a81-v2ef375ac784985212b1805e1d0431dc8f1b3c171 (2020-11-20)
- subsystems: qutebrowser/misc, qutebrowser/utils
- files: qutebrowser/misc/crashdialog.py, qutebrowser/misc/earlyinit.py, qutebrowser/utils/qtutils.py, qutebrowser/utils/utils.py, qutebrowser/utils/version.py
- preview: ## Title: Replace non-Qt version parsing with a Qt-native mechanism in specific modules  ### Description: Some parts of the codebase parse and compare version strings using a non Qt mechanism, leading to inconsistencies with Qt’s own versio

## Preliminary preflight readout
- Positives: enough tasks (79), deterministic grading, concentrated subsystems (`config`, `browser`, `utils`, `misc`), and deep history (25.8k commits, 2013-2026).
- Rationale signal exists but is not overwhelming: 27.2% of commits have bodies, 9.0% have long bodies, 11.6% hit coarse rationale keywords. Focused subsystems show 17-33% keyword density among commits touching those paths.
- Cutoff: per-task cutoff is safest; a single 2020 cutoff keeps 69/79 tasks, 2021 keeps 54/79.
- Still unverified: whether retrieved MCTS-Mem nodes map to task-relevant areas; requires a small partial-tree build and retrieval smoke test.
