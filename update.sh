#!/bin/bash
cd "$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

npm run-script build
git add index.* package.json *.sh
git commit -m "auto add"
git push
git rev-parse HEAD > ./.git_hash
