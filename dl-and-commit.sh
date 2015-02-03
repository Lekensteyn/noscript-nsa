#!/bin/sh
if [ -z "$1" ]; then
	set -- "$(curl -sI https://noscript.net/nsa/latest/ |
		awk '/^Location:/{print $NF}')"
	if [ -z "$1" ]; then
		echo "Unable to detect version!"
		exit 1
	fi
fi
version=${1##*noscript-}
version=${version%%.xpi*}
filename="noscript-$version.xpi"
url="https://noscript.net/nsa/latest/$filename"

# path to git dir
thisdir="$(dirname "$(readlink -f "$0")")"
outdir=$(pwd)

# utils
firstword() {
	awk '{print $1}'
}


if [ ! -s "$filename" ]; then
	if ! wget "$url"; then
		echo "'$filename' not found!"
		exit 1
	fi
fi

lastmod=$(date -Rud @$(stat -c %Y "$filename"))
size=$(du -b "$filename" | firstword)

committmp=$(mktemp)
trap "rm -f $committmp" EXIT

# Begin the update...
tee "$committmp" <<COMMIT_MSG
NSA $version

From $url

Last-Modified: $lastmod
File size: $size bytes

md5: $(md5sum "$filename" | firstword)
sha256: $(sha256sum "$filename" | firstword)
COMMIT_MSG

echo "Entering $thisdir..."
cd "$thisdir"

if ! git diff-index --quiet HEAD; then
	echo "Working directory is dirty, not extracting nor committing"
	exit 1
fi

if ! "$thisdir/extract.sh" "$outdir/$filename"; then
	echo "Failed to extract XPI"
	exit 1
fi

git add --all src

if git diff-index --quiet HEAD; then
	echo "No changes to commit."
	exit 1
fi

git commit -F "$committmp"
