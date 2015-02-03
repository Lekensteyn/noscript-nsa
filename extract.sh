#!/bin/bash
# Extracts the NoScript NSA XPI and post-processes it to make it more uniform.
# Author: Peter Wu <lekensteyn@gmail.com>

set -e

thisdir="$(dirname "$(readlink -f "$0")")"
xpi="$(readlink -f "$1")"
srcdir=$(pwd)/src
# for easier diff, rename '3.5a4rc201306082147' to $NSDIRNAME
NSDIRNAME=noscript-nsa

if [ -z "$1" ]; then
	echo "Usage: $0 foo.xpi"
	exit 1
elif [ ! -s "$xpi" ]; then
	echo "'$xpi' is not a valid XPI file"
	exit 1
fi

if [ -e "$srcdir" ] && [ -n "$(find "$srcdir" -maxdepth 0 -type d -empty)" ] &&
	[ ! -s "$srcdir/install.rdf" ]; then
	echo "'$srcdir' is non-empty but does not contain install.rdf."
	echo "Not continuing, perhaps I am destroying important stuff."
	exit 1
fi

tmpdir=$(mktemp -d)
trap "rm -rf $tmpdir" EXIT
cd "$tmpdir"
unzip -q "$xpi"
# Somehow the modes are completely messed up. First everything was executable...
# ok, but then since 3.5a7/modules/ resulted in mode 0???
chmod -R a-rwx,ug+rwX,o+rX "$tmpdir"

if [ -e "$NSDIRNAME" ]; then
	echo "'$NSDIRNAME' already exists in XPI?!"
	exit 1
fi

version=$(grep -Po 'em:version>\K[^<]*' install.rdf)
if [ -z "$version" ]; then
	echo "Could not find version string in install.rdf"
	exit 1
elif [ ! -d "$version" ]; then
	echo "A directory named after the version ('$version') was expected."
	exit 1
fi

### POST-PROCESSING
# Remove CR (a.k.a. Windows line endings) and ensure line ending
find "$tmpdir" -type f \
	-regex '.*\(txt\|xml\|rdf\|xul\|js\|css\|jsm\|html\)' -print0 |
	xargs -0 sed -i -e 's/\r//;$a\'
# Make version-agnostic:
# - rename directory $version
# - strip version from files
mv -v "$version" "$NSDIRNAME"
"$thisdir/version.sh" --strip "$version" "$tmpdir"

# Proceed with updating old sources
if [ -d "$srcdir" ]; then
	rm -rf "$srcdir.old"
	mv "$srcdir" "$srcdir.old"
	echo "Backed up $srcdir as $srcdir.old"
fi

mv "$tmpdir" "$srcdir"

echo
echo "XPI file   : $xpi"
echo "Version    : $version"
echo "Output dir : $srcdir"
