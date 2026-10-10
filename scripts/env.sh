# Source this to use the project-local Android toolchain (nothing installed globally):
#   source scripts/env.sh
# JDK 17 + Gradle come from the conda env "wristpilot"; the Android SDK and Gradle's
# cache live in .tooling/ next to the main checkout (gitignored).
# The main checkout is the parent of the shared .git dir (works from any worktree).
WRISTPILOT_ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
export WRISTPILOT_TOOLING="$WRISTPILOT_ROOT/.tooling"
export JAVA_HOME="$(conda info --base)/envs/wristpilot/lib/jvm"
export ANDROID_HOME="$WRISTPILOT_TOOLING/android-sdk"
export GRADLE_USER_HOME="$WRISTPILOT_TOOLING/gradle-home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
