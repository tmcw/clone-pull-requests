#!/usr/bin/env node

var ghauth = require('ghauth'),
    bole = require('bole'),
    queue = require('queue-async'),
    log = bole('clonepr'),
    request = require('request'),
    parseLinkHeader = require('parse-link-header'),
    argv = require('yargs')
        .describe('from', 'source repo')
        .describe('to', 'destination repo')
        .describe('branch', 'destination branch')
        .demand(['from', 'to', 'branch'])
        .argv;

bole.output({
  level: 'debug',
  stream: process.stdout
});

var concurrency = 1;
var throttle = 2000;

ghauth({
    configName: 'clone-pull-requests',
    scopes: ['repo']
}, function(err, authData) {
    if (err) throw err;

    var auth = { bearer: authData.token };
    var headers = {
        'User-Agent': 'clone repo pull requests'
    };

    var prs = [], completed = 0;

    function getAll(page) {
        request({
            url: 'https://api.github.com/repos/' + argv.from + '/pulls?per_page=100&page=' + page,
            auth: auth,
            headers: headers,
            json: true
        }, function(err, res, body) {
            if (err) throw err;
            prs = prs.concat(body);
            if (res.headers.link) {
                var links = parseLinkHeader(res.headers.link);
                if (links.next) {
                    log.info('downloading page ', links.next.page);
                    getAll(links.next.page);
                } else {
                    prsDownloaded();
                }
            }
        });
    }

    function prsDownloaded() {
        log.info('downloaded %s pull requests', prs.length);
        log.info('creating pull requests with concurrency=%s', concurrency);

        var q = queue(concurrency);
        prs.filter(function(pr) {
              return pr && pr.head && pr.head.repo && pr.head.repo.name;
          })
          .forEach(function(pr) {
              q.defer(createPullRequest, pr);
          });

        q.awaitAll(function() {
            log.info('PR CLONE COMPLETE');
        });
    }

    function createPullRequest(pr, callback) {
        setTimeout(function() {
            var head = pr.head.user.login + ':' + pr.head.ref;
            log.info('POST: https://api.github.com/repos/%s/pulls', argv.to);
            log.info('head %s', head);
            request({
                url: 'https://api.github.com/repos/' + argv.to + '/pulls',
                method: 'POST',
                auth: auth,
                body: {
                    title: pr.title,
                    body: pr.body,
                    head: head,
                    base: argv.branch
                },
                headers: headers,
                json: true
            }, function(reqErr, res, body) {
                callback(reqErr, body);
                if (body && body.message) {
                    log.info(body.message, body.errors);
                }
                if (!reqErr) {
                    log.info('%s/%s complete', ++completed, prs.length);
                } else {
                    log.error(reqErr);
                }
            });
        }, throttle);
    }

    getAll(1);
});
