- The kitten passes ssh a single inline /bin/sh script as the remote command; the script
  carries kitty's terminfo embedded in its own text.

- On the remote the script compiles that terminfo into `~/.terminfo` with `tic`, then
  execs the user's login shell — it does no other setup.

- All payload travels inside the ssh command line itself; nothing is requested back over
  the TTY and no archive, shell integration, file copy, env, or credential exchange
  exists.

## Moves

- 2022-02-23 (ddb87535) replaced by [[ssh-kitten]]: a script baked into the ssh command
  line can carry only the terminfo, while remote shell integration, arbitrary copied
  files and an on-demand kitten binary need an out-of-band channel, met by a bootstrap
  script that pulls a tar archive over the TTY (sourced).
