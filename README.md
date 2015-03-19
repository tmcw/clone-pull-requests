# clone-pull-requests

Given a source repository and a destination repository, both on GitHub,
take all PRs on the source and recreate them on the destination.

## Install

```sh
$ npm install -g clone-pull-requests
```

## Options

```
Options:
  --from    source repo         [required]
  --to      destination repo    [required]
  --branch  destination branch  [required]
```

## Example

```sh
$ clone-pull-requests --from=leereilly/swot --to=mapbox/swot --branch=master
```
