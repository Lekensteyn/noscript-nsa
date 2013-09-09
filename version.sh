#!/bin/bash
# adapted from https://github.com/avian2/noscript/blob/master/version.sh
# Remove/add version:
# - namespace "noscript_${version//./_}" in .*\.jsm?
# - version $version in src/bootstrap.js
# - NOT em:version in src/install.rdf

if [ "$#" -ne 3 ]; then
	echo "USAGE: version.sh [--add|--strip] version path"
	exit 1
fi

CMD=$1
VERSION=$2
TARGET=$3

REGEX='.*\.\(js\|jsm\|rdf\)'

PLACEHOLDER="@VERSION@"

if [ "$CMD" = "--add" ]; then
	SED_SCRIPT="s/noscript_$PLACEHOLDER/noscript_${VERSION//./_}/g"
	SED_SCRIPT2="s/$PLACEHOLDER/$VERSION/g"
elif [ "$CMD" = "--strip" ]; then
	SED_SCRIPT="s/noscript_${VERSION//./_}/noscript_$PLACEHOLDER/g"
	SED_SCRIPT2="s/${VERSION//./\\.}/$PLACEHOLDER/g"
	if find "$TARGET" -regex "$REGEX" -print0 | xargs -0 grep -q "$PLACEHOLDER"; then
		echo "Placeholder $PLACEHOLDER already present in source when stripping version!"
		exit 1
	fi

else
	echo "Invalid option $CMD"
	exit 1
fi

# Fail when either version change operation is unsuccessful
set -e

# 3_5a4rc201306082147
find "$TARGET" -regex "$REGEX" -print0 | \
	xargs -0 sed -i -e "$SED_SCRIPT"
# 3.5a4rc201306082147, do not remove em:version from install.rdf!
find "$TARGET" ! -name install.rdf -regex "$REGEX" -print0 | \
	xargs -0 sed -i -e "$SED_SCRIPT2"
