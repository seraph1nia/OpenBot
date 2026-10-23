#!/bin/sh
set -eu
umask 077
# Both setup and runtime lock the store. Released even on SIGKILL.
exec flock -n -E 73 /var/lib/mastra/writer.lock "$@"
