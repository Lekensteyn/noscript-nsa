#!/bin/sh
# Builds the NoScript NSA XPI file
# Author: Peter Wu <lekensteyn@gmail.com>

set -e

thisdir="$(dirname "$(readlink -f "$0")")"
outdir="$(pwd)"
srcdir="$thisdir/src"
NSDIRNAME=noscript-nsa

version=$(grep -Po 'em:version>\K[^<]*' "$srcdir/install.rdf")
if [ -z "$version" ]; then
	echo "Could not find version string in install.rdf"
	exit 1
fi

if [ ! -d "$srcdir/$NSDIRNAME" ]; then
	echo "Cannot find sources in $NSDIRNAME"
	exit 1
fi

XPI_NAME="noscript-$version.xpi"

tmpdir=$(mktemp -d)
trap "rm -rf $tmpdir" EXIT

cp -ra "$srcdir/"* "$tmpdir"
# Remove swap files, temporary junk, etc.
find "$tmpdir" \( -name "*~" -o -name ".*" \) -delete

# Pre-processing steps:
# - add version back
# - rename $NSDIRNAME to $VERSION
"$thisdir/version.sh" --add "$version" "$tmpdir"
mv "$tmpdir/$NSDIRNAME" "$tmpdir/$version"

# Finally remove old XPI and create new one
rm -f "$outdir/$XPI_NAME"
(cd "$tmpdir" && zip -q -r "$outdir/$XPI_NAME" .)

echo "XPI is ready: $XPI_NAME"
