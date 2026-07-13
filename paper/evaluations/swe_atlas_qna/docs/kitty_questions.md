## task-6905333b74f22949d97ba9e3  [Architecture & system design]
I'm  trying to wrap my head around kitty's remote control system because I want to eventually add a new command to it. I've been reading through the code but I'm getting lost in how all the pieces connect.

So here's what's confusing me. When I run something like kitten @ ls from another terminal, somehow that command finds its way to the running kitty instance, gets processed, and sends back a list of windows. But I can't figure out how the kitten knows where to send the command in the first place. Is it a socket? A pipe? Something else?

I got kitty built and running, but when I poke around 

## task-6905333b74f22949d97ba9e4  [Architecture & system design]
I'm onboarding into the Kitty repository and trying to understand how the SSH kitten behaves when it sets up a secure session and shares connections. It seems to do something clever with shared memory to pass credentials securely and then generates bootstrap scripts that run on the remote machine. I'm trying to piece together how the whole thing actually works end-to-end. Like, how does that archive with all the shell integration stuff get built and sent over? And how does the kitten keep track of everything it needs for a connection? The connection reuse part is also confusing me because I ca

## task-6905333b74f22949d97ba9e5  [Root-cause analysis]
I'm trying to understand how kitty's terminal reflow system works internally. When the window is resized, text needs to be redistributed across the new dimensions while maintaining line continuations and cursor positions. I've noticed some edge cases where the reflow doesn't seem to preserve logical line boundaries correctly. Can you trace through the rewrap implementation in the C code, explain how it handles the interaction between the visible screen buffer and the scrollback history during resize, and identify any potential issues with how line continuation state is propagated between these

## task-6905333b74f22949d97ba9e7  [Root-cause analysis]
I want to understand how the scrollback history buffer actually behaves under heavy load. If I generate a massive amount of terminal output, say, printing hundreds of thousands of lines rapidly, what happens to memory consumption as the history accumulates? I'd like to see actual memory measurements, not just understand the theory.

When I scroll back through a very large history while new output is still being generated, does the terminal remain responsive? What latency or lag can I observe between my scroll input and the display updating? Are there any visible signs of the system prioritizin

## task-6905333b74f22949d97ba9e9  [Architecture & system design]
I am trying to get a practical understanding of how kitty handles complex Unicode at runtime, especially in cases where the screen state is hard to reason about just by reading the code. When the terminal receives a stream of zero width joiners that form a multi codepoint emoji, how does the internal screen buffer decide what to keep when there is almost no space available, such as a one by one cell? What does the terminal think is actually present in that cell once everything settles? If the terminal is then asked to report part of its current state through a control sequence query, what resp

## task-6905333b74f22949d97ba9eb  [Architecture & system design]
I'm trying to understand exactly how the keyboard protocol stack behaves during alternating screen buffer switches, and I'm getting confused by what I observe versus what I expect.

Here's my situation: I'm writing a text-mode application that needs to push its own keyboard enhancement flags when it starts, but the application uses the alternate screen buffer, and I've noticed something strange. When I switch to the alternate buffer and then push keyboard flags, the behavior is different from when I push flags on the main buffer first and then switch to alternate. I can't figure out from readi

## task-6905333b74f22949d97ba9ee  [Architecture & system design]
I’m onboarding into the Kitty repository and trying to get an intuitive feel for how the diff kitten actually behaves when it compares files and directories, because people say it’s fast in a way that doesn’t feel obvious at first glance. When I point it at two directories, how does it decide what belongs together, and how does it sometimes recognize a rename instead of treating it like a deletion and a new file? That part feels almost magical. I also keep noticing that caching plays a big role, from raw file contents to highlighted output, but I don’t yet understand how that cache stays effic

## task-6905333b74f22949d97ba9f0  [Architecture & system design]
I want to get a clear picture of what happens when Kitty starts from this commit, before the terminal is ready for a shell. Set up a virtual framebuffer (Xvfb) to attempt headless execution and when Kitty launches, which systems start up on the way to a working terminal, and what do you actually see on screen or in logs that shows them coming online?

How does Kitty decide on its initial configuration when it starts? Which configuration sources or default settings does it use for the first launch, how do they affect what you see when the window appears, and what output during a real launch sho

## task-6905333b74f22949d97ba9f2  [Architecture & system design]
I’m onboarding into the Kitty repository and trying to understand how its terminal interaction pipeline behaves when it is actually alive and running, because it feels like a busy junction where keystrokes, paste bursts, and resize signals all arrive at once and still somehow turn into a coherent flow. When the terminal sends a surge of raw input, especially if a session is being paused and then resumed, how does that stream become something the application can react to, and where does it first enter the system? It feels like there is an unseen conductor managing timing, ordering, and state ha

## task-6905333b74f22949d97ba9f4  [Architecture & system design]
I need to understand kitty's build and test architecture by building it from source and running its test suite. Build kitty and execute the tests, then help me trace the relationship between the compiled C extensions and the test execution flow.

When the test suite runs, it depends on various compiled extension modules that get built during compilation. Run the tests and tell me what you observe about which extension modules actually get loaded during test execution and how test failures cascade when those modules are unavailable. What does the test output reveal about the dependency structur

## task-6905333b74f22949d97ba9f5  [Architecture & system design]
I want to understand how Kitty actually handles input event flow and focus management across windows, tabs, and child processes at runtime, without relying on assumptions from reading the source.

Start Kitty from this repository and interact with it in a way that creates overlapping input activity: open multiple tabs and windows, switch focus rapidly, send keyboard input while resizing and scrolling, and trigger at least one case where a background window is producing output while another window has focus. Observe what the system is actually doing while this is happening.

Based only on what 

## task-6905333b74f22949d97ba9f7  [Architecture & system design]
I'm trying to understand how kitty's C code handles communication with the shell process it spawns. Build kitty from source and launch it. When it starts a shell, what process gets spawned, what's the PID, what's the exact command line in the process list, and what PTY device path connects them? Type echo test123 in the running kitty terminal. What system calls does kitty make to read this from the PTY, what buffer size gets used, and how many bytes come back? Now run yes hello to generate continuous output. How does kitty's reading behavior change, what's the frequency of reads and the typica

## task-6905333b74f22949d97ba9f8  [Architecture & system design]
I’m trying to understand how Kitty divides rendering-adjacent work across Python, C, and Go, and I want to base that understanding on what can be demonstrated at runtime rather than assumptions from reading the repo.

Can you start Kitty from this repository and put it under sustained rendering pressure (lots of colored output, heavy scrollback churn, repeated resizes, and tab switching), then describe what the system is actually doing while it’s happening? I’m especially interested in what gets loaded into the main Kitty process (Kitty-specific modules plus major rendering/font libraries), ho

## task-6905333b74f22949d97ba9f9  [Architecture & system design]
I’m onboarding into the kitty terminal emulator and trying to make sense of its personality, because it calls itself GPU accelerated yet the codebase feels like a tight weave of Python and C. I keep wondering which language is really doing the heavy lifting once everything is running, and what that says about where performance actually comes from. The presence of scattered GLSL files only deepens the mystery. Shader code inside a terminal is not something I expected, so what role do those files play and how central are they to the system? When I try to run the main entry point directly, it fai

## task-6905333b74f22949d97ba9fa  [Architecture & system design]
I want to understand how kitty keeps its internal state consistent when terminal windows appear, resize, and disappear in quick succession. When a new window is created and immediately used to run a command, resize events and signals start flowing through the system. What happens if the window is gone before everything has finished reacting to those changes? How does kitty decide what state to keep and what to discard? I am especially interested in how timing affects signal delivery and internal bookkeeping, and whether there are moments where the system has to resolve conflicting views of wha

## task-6905333b74f22949d97ba9fb  [Root-cause analysis]
I'm new to Kitty and I'm having trouble with Kitty's search query parser and I suspect there might be a bug. When I combine multiple search terms with "or" and spaces, the results don't match what I expect. Items that should clearly match at least one term are being excluded entirely.

I looked through the code briefly but I couldn't figure out where the issue is or what logic is causing this. Can you investigate the parser implementation and explain what's actually happening? Running some test queries would help me see the behavior clearly.

If it turns out I'm just using the wrong syntax, I'

## task-6905333b74f22949d97ba9fc  [Architecture & system design]
I am trying to understand how kitty moves data between its core and the Python kittens when a lot is happening at once. Clipboard data can be small or very large, and it has to cross from internal screen structures into Python objects. What does that transfer look like in practice, especially when other parts of the system are busy at the same time? If the terminal is doing something expensive like scanning a large scrollback, does that affect how events are delivered to kittens or how memory is managed? I want to see where timing, concurrency, and object ownership start to matter, and how sub

## task-6905333b74f22949d97ba9fd  [Architecture & system design]
I'm onboarding to the kitty codebase and want to understand how its file transfer protocol enables efficient file copying over SSH connections. After building kitty from source, establish an SSH connection using the SSH kitten and initiate a file transfer, then help me trace the complete journey of file data through the transfer protocol. Specifically, I need to understand how the transfer kitten initiates the protocol handshake and what escape sequences establish the transfer session over the terminal connection. Once the session is established, how does kitty implement rsync-style delta tran

## task-6905333b74f22949d97ba9ff  [Architecture & system design]
I need to get kitty running from source to understand its initialization flow. Build and launch it, then help me trace what happens during the critical early startup phase. When kitty initializes, it goes through GPU context creation and font system setup. Run it and tell me what you observe about the rendering backend it actually selects and the display configuration it detects. What does the terminal report about its text rendering capabilities?

I'm particularly interested in understanding the relationship between the window system, GPU initialization, and the text cell calculations that ha

## task-6905333b74f22949d97baa01  [Code Onboarding]
I am onboarding to kitty repository and I want to understand how the kovidgoyal/kitty repo behaves when using the choose-fonts kitten, especially whether a font selection is remembered across restarts. I wonder how to start a single kitty instance with default settings, after building the repo and how to invoke the choose-fonts kitten from inside that instance? I wonder the end-to-end behavior of choose-fonts, like how the subcommand is registered and its options are parsed, how those option values flow through the program to the final confirmation step, and what kitty does when the selection 

## task-6905333b74f22949d97baa02  [Root-cause analysis]
I'm investigating how kitty terminal handles shell integration markers for command tracking, specifically the OSC 133 escape sequences that programs use to mark command boundaries.

I want to see what kitty does with these sequences. If I run a test program through kitty that writes OSC 133;A, OSC 133;B, OSC 133;C with a cmdline parameter, some text, and OSC 133;D;42 to its output, what's actually captured in the output? Are those OSC sequences still present in the output? What's the total byte length and at what byte offset does the "D;42" marker appear?

I'm also curious about how this chang

## task-6905333b74f22949d97baa03  [Architecture & system design]
I’m trying to understand how Kitty’s codebase handles input during normal use, so I want to build my understanding around what the program actually shows while it is running. If I start Kitty from this repository with whatever debugging or tracing options are available and press a few simple keys inside the default shell, what does the observable runtime behavior reveal about how input moves through Kitty’s core components before the screen updates? Based on those observations, describe at a high level which parts of the system appear to receive the input first, which parts seem to handle the 

## task-6905333b74f22949d97baa04  [Architecture & system design]
Hey, I'm trying to understand how Kitty behaves when it launches a program that runs normally and exits without an error.

Consider a scenario where Kitty starts a very simple program that prints a few clear lines to standard output and then exits with status zero. I want to understand the complete flow from the child process running to what happens after it exits. When a child program exits successfully with status zero, what exact exit code does Kitty's own process report, and what is the full message shown to the user about the program completing? Explain which part of the runtime flow is r

## task-6905333b74f22949d97baa05  [Code Onboarding]
I am onboarding to the kitty codebase and want to understand how the text shaping and layout engine configures support for complex Unicode (ligatures, bidi, combining diacritics) and font fallback during initial startup. With verbose logging enabled, what exact font families and fallback chains appear in startup diagnostics for handling mixed Arabic (RTL) and English (LTR) text, and what runtime configuration values confirm these selections before any text rendering begins? As the screen grid and shaping subsystems initialize, what default cell metrics, baseline positioning, and decoration ali

## task-6905333b74f22949d97baa06  [Architecture & system design]
I’m trying to get an intuitive feel for what Kitty’s history buffer really does when it’s pushed far beyond normal use, especially in moments where it feels like the terminal is being overwhelmed. If I trigger a command that pours out an enormous amount of text in a very short time, what actually unfolds inside the HistoryBuf as it fills, stretches, and starts carving out new segments? There seems to be a quiet interaction between the segmented scrollback storage and the pager-style ring buffer, and I’m curious how that relationship holds up when both are under stress. Does everything transiti

## task-6905333b74f22949d97baa07  [Architecture & system design]
I want to understand how kitty behaves when a large amount of terminal graphics data arrives faster than the system can comfortably respond. As data flows in and the terminal tries to react, how does it decide whether to buffer, pause, or slow things down? What happens internally when responses need to be written back but the output path is already under pressure? I am curious where those decisions live in the code and how they show up at runtime when the terminal is clearly being pushed beyond its usual pace. Does the system quietly adapt, or are there visible signs that something has shifted

