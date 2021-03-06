'use strict';

var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    Imbo = require('../../');

var fixtures = path.join(__dirname, '..', 'fixtures'),
    catMd5 = '61da9892205a0d5077a353eb3487e8c8';

var signatureCleaner = function(urlPath) {
    return (urlPath
        .replace(/timestamp=[^&]*&?/, '')
        .replace(/signature=[^&]*&?/, '')
        .replace(/accessToken=[^&]*&?/, '')
        .replace(/[?&]$/g, '')
    );
};

var urlCleaner = function(urlPath) {
    return (signatureCleaner(urlPath)
        .replace(/publicKey=[^&]*&?/, '')
        .replace(/[?&]$/g, '')
    );
};

var bodyCleaner = function() {
    return '*';
};

var client, errClient, mock, mockImgUrl;

describe('ImboClient', function() {
    beforeEach(function() {
        client = new Imbo.Client(['http://imbo', 'http://imbo1', 'http://imbo2'], 'pub', 'priv');
        errClient = new Imbo.Client('http://localhost:6776', 'pub', 'priv');

        mock = getNock()('http://imbo');
        mockImgUrl = getNock()('http://imbo1');
    });

    afterEach(function() {
        mock.done();
        mockImgUrl.done();
    });

    describe('#constructor()', function() {
        it('should throw on invalid hosts', function() {
            assert.throws(function() {
                client = new Imbo.Client({});
            }, /hosts/);

            assert.throws(function() {
                client = new Imbo.Client({ hosts: {} });
            }, /hosts/);
        });

        it('should throw on invalid publicKey', function() {
            assert.throws(function() {
                client = new Imbo.Client({ hosts: ['foo'], publicKey: '' });
            }, /publicKey/);

            assert.throws(function() {
                client = new Imbo.Client({ hosts: ['foo'], publicKey: [] });
            }, /publicKey/);
        });

        it('should throw on invalid privateKey', function() {
            assert.throws(function() {
                client = new Imbo.Client({ hosts: ['foo'], publicKey: 'foo', privateKey: '' });
            }, /privateKey/);

            assert.throws(function() {
                client = new Imbo.Client({ hosts: ['foo'], publicKey: 'foo', privateKey: [] });
            }, /privateKey/);
        });

        it('should throw on invalid user', function() {
            assert.throws(function() {
                client = new Imbo.Client({ hosts: ['foo'], publicKey: 'foo', privateKey: 'bar', user: [] });
            }, /user/);
        });
    });

    describe('#getServerStatus()', function() {
        it('should return error on a 503-response', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/status')
                .reply(503);

            client.getServerStatus(function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/status')
                .reply(200);

            client.getServerStatus(function(err) {
                assert.ifError(err, 'getServerStatus should not give an error on success');
                done();
            });
        });

        it('should convert "date" key to a Date instance', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/status')
                .reply(200, JSON.stringify({
                    date: 'Fri, 14 Mar 2014 07:43:49 GMT'
                }), { 'Content-Type': 'application/json' });

            client.getServerStatus(function(err, info, res) {
                assert.ifError(err, 'getServerStatus should not give an error on success');
                assert.ok(info.date instanceof Date);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should add status code to info object', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/status')
                .reply(200, JSON.stringify({
                    date: 'Fri, 14 Mar 2014 07:43:49 GMT'
                }), { 'Content-Type': 'application/json' });

            client.getServerStatus(function(err, info) {
                assert.ifError(err, 'getServerStatus should not give an error on success');
                assert.equal(200, info.status);
                done();
            });
        });
    });

    describe('#getServerStats()', function() {
        it('should return error on a 503-response', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/stats')
                .reply(503);

            client.getServerStats(function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/stats')
                .reply(200);

            client.getServerStats(function(err) {
                assert.ifError(err, 'getServerStats should not give an error on success');
                done();
            });
        });

        it('should give back a meaningful info object', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/stats')
                .reply(200, JSON.stringify({
                    foo: 'bar',
                    number: 1337
                }), { 'Content-Type': 'application/json' });

            client.getServerStats(function(err, info) {
                assert.ifError(err, 'getServerStats should not give an error on success');
                assert.equal(1337, info.number);
                assert.equal('bar', info.foo);
                done();
            });
        });
    });

    describe('#getImageChecksum', function() {
        it('should return an error if file does not exist', function(done) {
            var filename = path.join(__dirname, '/does-not-exist.jpg');
            client.getImageChecksum(filename, function(err) {
                assert.equal('File does not exist (' + filename + ')', err);
                done();
            });
        });

        it('should generate correct md5sum for a file that exists', function(done) {
            client.getImageChecksum(fixtures + '/cat.jpg', function(err, identifier) {
                assert.ifError(err, 'getImageChecksum should not give an error on success');
                assert.equal(catMd5, identifier);
                done();
            });
        });
    });

    describe('#getImageChecksumFromBuffer', function() {
        it('should generate correct md5sum for a normal text string', function(done) {
            client.getImageChecksumFromBuffer('pliney-the-elder', function(err, identifier) {
                assert.ifError(err, 'getImageChecksumFromBuffer should not give an error on success');
                assert.equal('f755bd139f9026604d4bdd31bf6ee50e', identifier);
                done();
            });
        });

        it('should generate correct md5sum for a buffer', function(done) {
            var content = fs.readFileSync(fixtures + '/cat.jpg');
            client.getImageChecksumFromBuffer(content, function(err, identifier) {
                assert.ifError(err, 'getImageChecksumFromBuffer should not give an error on success');
                assert.equal(catMd5, identifier);
                done();
            });
        });
    });

    describe('#getImageUrl', function() {
        it('should throw if given a non-string identifier', function() {
            assert.throws(function() {
                client.getImageUrl(null);
            }, /imageIdentifier/);
        });

        it('should throw if given an empty string as identifier', function() {
            assert.throws(function() {
                client.getImageUrl('');
            }, /imageIdentifier/);
        });

        it('should return a ImageUrl-instance', function() {
            var url = client.getImageUrl(catMd5);
            assert.equal(true, url instanceof Imbo.ImageUrl, 'getImageUrl did not return instance of ImageUrl');
        });

        it('should return something containing the image identifier', function() {
            var url = client.getImageUrl(catMd5).toString();
            assert.equal(true, url.indexOf(catMd5) > 0, url + ' did not contain ' + catMd5);
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getImageUrl(catMd5).toString();
            assert.equal('http://imbo/users/someuser/images/' + catMd5 + '?publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#parseImageUrl', function() {
        it('should return an ImageUrl-instance', function() {
            var url = 'http://imbo/users/pub/images/' + catMd5 + '.jpg',
                qs = '?t[]=flipHorizontally';

            var imageUrl = client.parseImageUrl(url + qs);

            assert.ok(imageUrl instanceof Imbo.ImageUrl, 'getImageUrl did not return instance of ImageUrl');
        });

        it('should allow passing a different private key', function() {
            var url = 'http://imbo/users/pub/images/' + catMd5 + '.jpg';

            var original = client.parseImageUrl(url).toString().replace(/.*?accessToken=/, '');
            var modified = client.parseImageUrl(url, 'foo').toString().replace(/.*?accessToken=/, '');

            assert.notEqual(original, modified);
        });

        it('should correctly parse URLs with transformations', function() {
            var url = 'http://imbo/users/pub/images/' + catMd5 + '.jpg',
                qs = '?t[]=flipHorizontally';

            assert(client.parseImageUrl(url + qs).toString().indexOf(url + '?t%5B%5D=flipHorizontally') > -1);
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getImageUrl(catMd5).toString();
            assert.equal(client.parseImageUrl(url, 'bar').toString(), url);
        });

        // More tests are defined in the ImageUrl test suite
    });

    describe('#getImagesUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getImagesUrl();
            assert.equal(true, url instanceof Imbo.Url, 'getImagesUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getImagesUrl().toString();
            assert.equal('http://imbo/users/pub/images', signatureCleaner(url));
        });

        it('should return the global images URL if a user filter is specified', function() {
            var query = (new Imbo.Query()).users(['foo', 'bar']);
            var url = client.getImagesUrl(query).toString();
            assert(signatureCleaner(url).indexOf('http://imbo/images') === 0);
            assert(signatureCleaner(url).indexOf('users[]=foo&users[]=bar') !== -1);
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getImagesUrl().toString();
            assert.equal('http://imbo/users/someuser/images?publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#user', function() {
        it('should be able to switch the client user', function() {
            var url = client.getUserUrl().toString();
            assert.equal('http://imbo/users/pub', signatureCleaner(url));

            url = client.user('foo').getUserUrl().toString();
            assert.equal('http://imbo/users/foo?publicKey=pub', signatureCleaner(url));

            url = client.user('pub').getUserUrl().toString();
            assert.equal('http://imbo/users/pub', signatureCleaner(url));
        });
    });

    describe('#getUserUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getUserUrl();
            assert.equal(true, url instanceof Imbo.Url, 'getUserUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getUserUrl().toString();
            assert.equal('http://imbo/users/pub', signatureCleaner(url));
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getUserUrl().toString();
            assert.equal('http://imbo/users/someuser?publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#getStatusUrl', function() {
        it('should return a URL with the first defined host as hostname', function() {
            var url = client.getStatusUrl().toString();
            assert.equal('http://imbo/status', signatureCleaner(url));
        });
    });

    describe('#getStatsUrl', function() {
        it('should return a URL with the first defined host as hostname', function() {
            var url = client.getStatsUrl().toString();
            assert.equal('http://imbo/stats', signatureCleaner(url));
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getStatsUrl().toString();
            assert.equal('http://imbo/stats?publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#getMetadataUrl', function() {
        it('should return a URL with the first defined host as hostname', function() {
            var url = client.getMetadataUrl(catMd5).toString();
            assert.equal(
                'http://imbo/users/pub/images/' + catMd5 + '/meta',
                signatureCleaner(url)
            );
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getMetadataUrl(catMd5).toString();
            assert.equal('http://imbo/users/someuser/images/' + catMd5 + '/meta?publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#getResourceUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getResourceUrl({
                path: '/some/path',
                queryString: 'page=2&limit=3'
            });

            assert.equal(true, url instanceof Imbo.Url, 'getResourceUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getResourceUrl({
                path: '/some/path',
                query: 'page=2&limit=3'
            }).toString();

            assert(url.indexOf('http://imbo/some/path?page=2&limit=3&accessToken') > -1);
        });

        it('should handle different user/public key combination', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getResourceUrl({
                path: '/some/path',
                query: 'page=2&limit=3'
            }).toString();

            assert.equal('http://imbo/some/path?page=2&limit=3&publicKey=foo', signatureCleaner(url));
        });

        it('should handle being told to use a specific user', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getResourceUrl({
                path: '/some/path',
                query: 'page=2&limit=3',
                user: 'zing'
            }).toString();

            assert.equal('http://imbo/some/path?page=2&limit=3&publicKey=foo', signatureCleaner(url));
        });
    });

    describe('#getShortUrl()', function() {
        it('should return error on a 503-response', function(done) {
            var imgUrl = client.getImageUrl(catMd5);

            mockImgUrl.filteringPath(urlCleaner)
                .post('/users/pub/images/' + catMd5 + '/shorturls')
                .reply(503);

            client.getShortUrl(imgUrl, function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should return error if no id was present in body', function(done) {
            var imgUrl = client.getImageUrl(catMd5);

            mockImgUrl.filteringPath(urlCleaner)
                .post('/users/pub/images/' + catMd5 + '/shorturls')
                .reply(200, JSON.stringify({
                    foo: 'bar'
                }), { 'Content-Type': 'application/json' });

            client.getShortUrl(imgUrl, function(err) {
                assert.ok(err);
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            var imgUrl = client.getImageUrl(catMd5).thumbnail().png(),
                expected = 'http://imbo1/s/imboF00';

            mockImgUrl.filteringPath(urlCleaner)
                .post('/users/pub/images/' + catMd5 + '/shorturls')
                .reply(200, JSON.stringify({
                    id: 'imboF00'
                }), { 'Content-Type': 'application/json' });

            client.getShortUrl(imgUrl, function(err, shortUrl) {
                assert.ifError(err, 'getShortUrl should not give an error on success');
                assert.equal(shortUrl.toString(), expected);
                done();
            });
        });
    });

    describe('#deleteAllShortUrlsForImage()', function() {
        it('should return error on backend failure', function(done) {
            mockImgUrl.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/shorturls', 'DELETE')
                .reply(503);

            client.deleteAllShortUrlsForImage(catMd5, function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mockImgUrl.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/shorturls', 'DELETE')
                .reply(200, 'OK');

            client.deleteAllShortUrlsForImage(catMd5, function(err) {
                assert.ifError(err, 'deleteAllShortUrlsForImage should not give an error on success');
                done();
            });
        });
    });

    describe('#deleteShortUrlForImage', function() {
        var shortId = 'imboF00';

        it('should return error on backend failure', function(done) {
            mockImgUrl.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/shorturls/' + shortId, 'DELETE')
                .reply(503);

            client.deleteShortUrlForImage(catMd5, shortId, function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mockImgUrl.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/shorturls/' + shortId, 'DELETE')
                .reply(200, 'OK');

            client.deleteShortUrlForImage(catMd5, shortId, function(err) {
                assert.ifError(err, 'deleteShortUrlForImage should not give an error on success');
                done();
            });
        });

        it('should handle being passed a shortUrl', function(done) {
            var shortUrl = new Imbo.ShortUrl({ id: shortId });

            mockImgUrl.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/shorturls/' + shortId, 'DELETE')
                .reply(200, 'OK');

            client.deleteShortUrlForImage(catMd5, shortUrl, function(err) {
                assert.ifError(err, 'deleteShortUrlForImage should not give an error on success');
                done();
            });
        });
    });

    describe('#generateSignature', function() {
        it('should generate a valid signature', function() {
            var sig;
            sig = client.generateSignature('GET', '/images', '2012-10-11T15:10:17Z');
            assert.equal(sig, 'fd16a910040350f12df83b2e077aa2afdcd0f4d262e69eb84d3ad3ee1e5a243c');

            sig = client.generateSignature('PUT', '/images/' + catMd5 + '/meta', '2012-10-03T12:43:37Z');
            assert.equal(sig, 'afd4c4de76a95d5ed5c23a908278cab40817012a5a5c750d971177d3cba97bf5');
        });
    });

    describe('#getSignedResourceUrl', function() {
        it('should generate a valid, signed resource url', function() {
            var url = client.getSignedResourceUrl('PUT', '/images/' + catMd5 + '/meta', new Date(1349268217000));
            assert.equal(url, '/images/' + catMd5 + '/meta?signature=afd4c4de76a95d5ed5c23a908278cab40817012a5a5c750d971177d3cba97bf5&timestamp=2012-10-03T12%3A43%3A37Z');
        });

        it('should add a public key if user and public key differs', function() {
            client = new Imbo.Client({ hosts: 'http://imbo', publicKey: 'foo', privateKey: 'bar', user: 'someuser' });
            var url = client.getSignedResourceUrl('PUT', '/images/' + catMd5 + '/meta', new Date(1349268217000));
            assert.equal(url, '/images/' + catMd5 + '/meta?publicKey=foo&signature=9e16eee7c7b997e006c1843cefed174e0f0aef142dbf80abc8c4a94c83dd2b2a&timestamp=2012-10-03T12%3A43%3A37Z');
        });
    });

    describe('#getHostForImageIdentifier', function() {
        it('should return the same host for the same image identifiers every time', function() {
            for (var i = 0; i < 10; i++) {
                assert.equal('http://imbo1', client.getHostForImageIdentifier('61ca9892205a0d5077a353eb3487e8c8'));
                assert.equal('http://imbo2', client.getHostForImageIdentifier('3b71c51547c3aa1ae81a5e9c57dfef67'));
                assert.equal('http://imbo1', client.getHostForImageIdentifier('61ca9892205a0d5077a353eb3487e8c8'));
                assert.equal('http://imbo', client.getHostForImageIdentifier('3faab4bb128b56bd7d7e977164b3cc7f'));
            }
        });
    });

    describe('#headImage()', function() {
        it('should return error on a 404-response', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(404);

            client.headImage(catMd5, function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });

        it('should return error on a 503-response', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(503);

            client.headImage(catMd5, function(err) {
                assert(err);
                assert(err.message.match(/\b503\b/));
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200);

            client.headImage(catMd5, function(err) {
                assert.ifError(err, 'headImage should not give an error on success');
                done();
            });
        });

        it('should return an http-response on success', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK', { 'X-Imbo-Imageidentifier': catMd5 });

            client.headImage(catMd5, function(err, res) {
                assert.ifError(err);
                assert.equal(res.headers['x-imbo-imageidentifier'], catMd5);
                done();
            });
        });

        it('should return error when host could not be reached', function(done) {
            this.timeout(10000);
            errClient.headImage(catMd5, function(err) {
                assert.ok(err, 'headImage should give error if host is unreachable');
                done();
            });
        });
    });

    describe('#deleteImage', function() {
        it('should return an http-response on success', function(done) {
            mock.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5, 'DELETE')
                .reply(200, 'OK', { 'X-Imbo-Imageidentifier': catMd5 });

            client.deleteImage(catMd5, function(err, res) {
                assert.ifError(err);
                assert.equal(res.headers['x-imbo-imageidentifier'], catMd5);
                done();
            });
        });
    });

    describe('#imageIdentifierExists', function() {
        it('should return true if the identifier exists', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK');

            client.imageIdentifierExists(catMd5, function(err, exists) {
                assert.ifError(err, 'Image that exists should not give an error');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(404, 'Image not found');

            client.imageIdentifierExists(catMd5, function(err, exists) {
                assert.ifError(err, 'imageIdentifierExists should not fail when image does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.imageIdentifierExists(catMd5, function(err) {
                assert.ok(err, 'imageIdentifierExists should give error if host is unreachable');
                done();
            });
        });
    });

    describe('#imageExists', function() {
        it('should return error if the local image does not exist', function(done) {
            var filename = fixtures + '/non-existant.jpg';
            client.imageExists(filename, function(err) {
                assert.equal('File does not exist (' + filename + ')', err);
                done();
            });
        });

        it('should return true if the image exists on disk and on server', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=1&originalChecksums[]=' + catMd5)
                .reply(200, {
                    search: { hits: 1 },
                    images: [ { imageIdentifier: catMd5 } ]
                }, {
                    'Content-Type': 'application/json'
                });

            client.imageExists(fixtures + '/cat.jpg', function(err, exists) {
                assert.ifError(err, 'imageExists should not give error if image exists on disk and server');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the image exists on disk but not on server', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=1&originalChecksums[]=' + catMd5)
                .reply(200, {
                    search: { hits: 0 },
                    images: []
                }, {
                    'Content-Type': 'application/json'
                });

            client.imageExists(fixtures + '/cat.jpg', function(err, exists) {
                assert.ifError(err, 'imageExists should not give error if the image does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });
    });

    describe('#imageWithChecksumExists', function() {
        it('should return true if the image exists on server', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=1&originalChecksums[]=' + catMd5)
                .reply(200, {
                    search: { hits: 1 },
                    images: [ { imageIdentifier: catMd5 } ]
                }, {
                    'Content-Type': 'application/json'
                });

            client.imageWithChecksumExists(catMd5, function(err, exists) {
                assert.ifError(err, 'imageWithChecksumExists should not give error if image exists on server');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the image does exist on server', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=1&originalChecksums[]=' + catMd5)
                .reply(200, {
                    search: { hits: 0 },
                    images: []
                }, {
                    'Content-Type': 'application/json'
                });

            client.imageWithChecksumExists(catMd5, function(err, exists) {
                assert.ifError(err, 'imageWithChecksumExists should not give error if the image does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });

        it('should give back error if encountering server issues', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=1&originalChecksums[]=' + catMd5)
                .reply(503, 'Internal Server Error');

            client.imageWithChecksumExists(catMd5, function(err) {
                assert.ok(err, 'imageWithChecksumExists should not give error if the image does not exist on server');
                done();
            });
        });
    });

    describe('#addImage', function() {
        it('should return error if the local image does not exist', function(done) {
            var filename = fixtures + '/does-not-exist.jpg';
            client.addImage(filename, function(err) {
                assert.ok(err, 'addImage should give error if file does not exist');
                assert.equal(err.code, 'ENOENT');
                done();
            });
        });

        it('should return an error if the image could not be added', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(400, 'Image already exists', { 'X-Imbo-Imageidentifier': catMd5 });

            client.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(null, imageIdentifier);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.addImage(fixtures + '/cat.jpg', function(err) {
                assert.ok(err, 'addImage should give error if host is unreachable');
                done();
            });
        });

        it('should return an image identifier and an http-response on success', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(201, { imageIdentifier: catMd5 }, {
                    'X-Imbo-ImageIdentifier': catMd5,
                    'Content-Type': 'application/json'
                });

            client.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier, body, response) {
                assert.ifError(err);
                assert.equal(catMd5, imageIdentifier);
                assert.equal(catMd5, body.imageIdentifier);
                assert.equal(201, response.statusCode);

                done();
            });
        });
    });

    describe('#addImageFromBuffer', function() {
        it('should return an error if the image could not be added', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(400, 'Image already exists', {
                    'X-Imbo-Imageidentifier': catMd5
                });

            var buffer = fs.readFileSync(fixtures + '/cat.jpg');
            client.addImageFromBuffer(buffer, function(err, imageIdentifier) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(null, imageIdentifier);
                done();
            });
        });

        it('should return an image identifier and an http-response on success', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(201, { imageIdentifier: catMd5 }, {
                    'X-Imbo-Imageidentifier': catMd5,
                    'Content-Type': 'application/json'
                });

            var buffer = fs.readFileSync(fixtures + '/cat.jpg');
            client.addImageFromBuffer(buffer, function(err, imageIdentifier, body, response) {
                assert.ifError(err);
                assert.equal(catMd5, imageIdentifier);
                assert.equal(catMd5, body.imageIdentifier);
                assert.equal(201, response.statusCode);

                done();
            });
        });
    });

    describe('#addImageFromUrl', function() {
        it('should return error if the remote image does not exist', function(done) {
            mock.get('/some-404-image.jpg')
                .reply(404);

            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(404);

            var url = 'http://imbo/some-404-image.jpg';
            client.addImageFromUrl(url, function(err) {
                assert.ok(err, 'addImage should give error if file does not exist');
                assert(err.message.match(/\b404\b/));
                done();
            });
        });

        it('should return an error if the image could not be added', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(400, 'Image already exists', {
                    'X-Imbo-Imageidentifier': catMd5
                });

            mock.get('/cat.jpg')
                .reply(200, fs.readFileSync(path.join(fixtures, 'cat.jpg')));

            client.addImageFromUrl('http://imbo/cat.jpg', function(err, imageIdentifier) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(null, imageIdentifier);
                done();
            });
        });

        it('should return an image identifier and an http-response on success', function(done) {
            mock.filteringPath(urlCleaner)
                .filteringRequestBody(bodyCleaner)
                .post('/users/pub/images', '*')
                .reply(201, { imageIdentifier: catMd5 }, {
                    'X-Imbo-ImageIdentifier': catMd5,
                    'Content-Type': 'application/json'
                });

            mock.get('/cat.jpg')
                .reply(200, fs.readFileSync(fixtures + '/cat.jpg'), {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': fs.statSync(fixtures + '/cat.jpg').size
                });

            client.addImageFromUrl('http://imbo/cat.jpg', function(err, imageIdentifier, body, response) {
                assert.ifError(err);
                assert.equal(catMd5, imageIdentifier);
                assert.equal(catMd5, body.imageIdentifier);
                assert.equal(201, response.statusCode);

                done();
            });
        });
    });

    describe('#getUserInfo', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(200, JSON.stringify({ foo: 'bar' }), { 'Content-Type': 'application/json' });

            client.getUserInfo(function(err, info, res) {
                assert.ifError(err, 'getUserInfo should not give an error on success');
                assert.equal('bar', info.foo);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the user does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(404, 'Not Found');

            client.getUserInfo(function(err, body, res) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                assert.equal('Not Found', body);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should convert lastModified key to a Date instance', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(200, JSON.stringify({
                    lastModified: 'Fri, 14 Mar 2014 07:43:49 GMT'
                }), { 'Content-Type': 'application/json' });

            client.getUserInfo(function(err, info, res) {
                assert.ifError(err, 'getUserInfo should not give an error on success');
                assert.ok(info.lastModified instanceof Date);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should populate the `user` property if not present', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(200, JSON.stringify({
                    publicKey: 'foo'
                }), { 'Content-Type': 'application/json' });

            client.getUserInfo(function(err, info) {
                assert.ifError(err, 'getUserInfo should not give an error on success');
                assert.equal(info.user, 'foo');
                done();
            });
        });
    });

    describe('#getImageProperties', function() {
        it('should return an object on success', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK', {
                    'X-Imbo-OriginalWidth': 123,
                    'X-Imbo-OriginalHeight': 456,
                    'X-Imbo-OriginalFilesize': 123456,
                    'X-Imbo-OriginalExtension': 'png',
                    'X-Imbo-OriginalMimeType': 'image/png'
                });

            client.getImageProperties(catMd5, function(err, props) {
                assert.ifError(err, 'getImageProperties() should not give an error on success');
                assert.equal(123, props.width);
                assert.equal(456, props.height);
                assert.equal(123456, props.filesize);
                assert.equal('png', props.extension);
                assert.equal('image/png', props.mimetype);
                done();
            });
        });

        it('should return an error if the image does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/users/pub/images/f00baa')
                .reply(404, 'Not Found');

            client.getImageProperties('f00baa', function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });
    });

    describe('#getImageData', function() {
        it('should return a buffer on success', function(done) {
            var expectedBuffer = new Buffer('str');

            mockImgUrl.filteringPath(urlCleaner)
                .get('/users/pub/images/' + catMd5)
                .reply(200, expectedBuffer);

            client.getImageData(catMd5, function(err, data) {
                assert.ifError(err, 'getImageData() should not give an error on success');
                assert.equal(expectedBuffer.toString(), data.toString());
                done();
            });
        });

        it('should return an error if the image does not exist', function(done) {
            mockImgUrl.filteringPath(urlCleaner)
                .get('/users/pub/images/f00baa')
                .reply(404, 'Not Found');

            client.getImageData('f00baa', function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });
    });

    describe('#getNumImages', function() {
        it('should return a number on success', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(200, JSON.stringify({ numImages: 50 }), { 'Content-Type': 'application/json' });

            client.getNumImages(function(err, numImages) {
                assert.ifError(err, 'getNumImages() should not give an error on success');
                assert.equal(50, numImages);
                done();
            });
        });

        it('should return an error if the user does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub')
                .reply(404, 'Not Found');

            client.getNumImages(function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });
    });

    describe('#getImages', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images')
                .reply(200, JSON.stringify({ images: [], search: { hits: 3 } }), {
                    'Content-Type': 'application/json'
                });

            client.getImages(function(err, images, search, res) {
                assert.ifError(err, 'getImages should not give an error on success');
                assert.equal(3, search.hits);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the user does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images')
                .reply(404, 'User not found');

            client.getImages(function(err, images, search, res) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should allow an optional query', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images?page=1&limit=5&ids[]=blah')
                .reply(200, JSON.stringify({ images: [], search: { hits: 0 } }), {
                    'Content-Type': 'application/json'
                });

            var query = new Imbo.Query().limit(5).ids(['blah']);
            client.getImages(query, function(err, images, search, res) {
                assert.ifError(err, 'getImages should not give an error on success');
                assert.equal(0, search.hits);
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#getMetadata', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images/' + catMd5 + '/meta')
                .reply(200, JSON.stringify({ foo: 'bar' }), { 'Content-Type': 'application/json' });

            client.getMetadata(catMd5, function(err, meta, res) {
                assert.ifError(err, 'getMetadata should not give error on success');
                assert.equal('bar', meta.foo);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/users/pub/images/f00baa/meta')
                .reply(404, 'Image not found');

            client.getMetadata('f00baa', function(err, body, res) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                assert.equal('Image not found', body);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    });

    describe('#deleteMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .intercept('/users/pub/images/f00baa/meta', 'DELETE')
                .reply(404, 'Image not found');

            client.deleteMetadata('f00baa', function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });

        it('should not return any error on success', function(done) {
            mock.filteringPath(urlCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/meta', 'DELETE')
                .reply(200, 'OK');

            client.deleteMetadata(catMd5, function(err) {
                assert.ifError(err, 'deleteMetadata should not give error on success');
                done();
            });
        });
    });

    describe('#editMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .post('/users/pub/images/f00baa/meta', { foo: 'bar' })
                .reply(404, 'Image not found');

            client.editMetadata('f00baa', { foo: 'bar' }, function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });

        it('should not return any error on success', function(done) {
            var response = { foo: 'bar', existing: 'key' };
            mock.filteringPath(urlCleaner)
                .post('/users/pub/images/' + catMd5 + '/meta', { foo: 'bar' })
                .reply(200, response, {
                    'Content-Type': 'application/json'
                });

            client.editMetadata(catMd5, { foo: 'bar' }, function(err, body, res) {
                assert.ifError(err, 'editMetadata should not give error on success');
                assert.equal(200, res.statusCode);
                assert.equal(JSON.stringify(response), JSON.stringify(body));
                done();
            });
        });
    });

    describe('#replaceMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .put('/users/pub/images/f00baa/meta', { foo: 'bar' })
                .reply(404, 'Image not found');

            client.replaceMetadata('f00baa', { foo: 'bar' }, function(err) {
                assert(err);
                assert(err.message.match(/\b404\b/));
                done();
            });
        });

        it('should not return any error on success', function(done) {
            var responseBody = { foo: 'bar', some: 'key' },
                sentData = { some: 'key', foo: 'bar' };

            mock.filteringPath(urlCleaner)
                .put('/users/pub/images/' + catMd5 + '/meta', sentData)
                .reply(200, responseBody, {
                    'Content-Type': 'application/json'
                });

            client.replaceMetadata(catMd5, sentData, function(err, body, res) {
                assert.ifError(err, 'replaceMetadata should not give error on success');
                assert.equal(200, res.statusCode);
                assert.equal(responseBody.foo, body.foo);
                assert.equal(responseBody.some, body.some);
                assert.equal(
                    Object.keys(responseBody).length,
                    Object.keys(body).length
                );

                done();
            });
        });
    });

    describe('#getResourceGroups', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/groups')
                .reply(200, JSON.stringify({ groups: [], search: { hits: 0 } }), {
                    'Content-Type': 'application/json'
                });

            client.getResourceGroups(function(err, images, search, res) {
                assert.ifError(err, 'getResourceGroups should not give an error on success');
                assert.equal(0, search.hits);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/groups')
                .reply(400, 'Permission denied (public key)');

            client.getResourceGroups(function(err, images, search, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should returns the right data in groups/search', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/groups')
                .reply(200, JSON.stringify({
                    groups: [{
                        name: 'read-user',
                        resources: ['user.get', 'user.head']
                    }],
                    search: {
                        count: 1,
                        limit: 1,
                        page: 2,
                        hits: 3
                    }
                }), {
                    'Content-Type': 'application/json'
                });

            client.getResourceGroups(function(err, images, search, res) {
                assert.ifError(err, 'getResourceGroups should not give an error on success');
                assert.equal(3, search.hits);
                assert.equal(2, search.page);
                assert.equal(1, search.count);
                assert.equal(1, search.limit);
                assert.equal('read-user', images[0].name);
                assert.equal('user.get', images[0].resources[0]);
                assert.equal('user.head', images[0].resources[1]);
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#getResourceGroup', function() {
        it('should return an array of resources', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/groups/somegroup')
                .reply(200, { resources: ['foo', 'bar'] });

            client.getResourceGroup('somegroup', function(err, resources, res) {
                assert.ifError(err, 'getResourceGroup should not give an error on success');
                assert.equal(2, resources.length);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/groups/somegroup')
                .reply(400, 'Permission denied (public key)');

            client.getResourceGroup('somegroup', function(err, resources, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#addResourceGroup', function() {
        it('should return error if resource group already exists', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/waffles')
                .reply(200);

            client.addResourceGroup('waffles', ['foo', 'bar'], function(err) {
                assert(err);
                assert(err.message.match(/already exists/));
                done();
            });
        });

        it('should return error if resource group check fails', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/waffles')
                .reply(400, 'Permission denied (public key)');

            client.addResourceGroup('waffles', ['foo', 'bar'], function(err) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/waffles')
                .reply(404);

            mock.filteringPath(urlCleaner)
                .put('/groups/waffles')
                .reply(400, 'Permission denied (public key)');

            client.addResourceGroup('waffles', ['foo', 'bar'], function(err, body, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not give error on successful addition', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/waffles')
                .reply(404);

            mock.filteringPath(urlCleaner)
                .put('/groups/waffles', ['foo', 'bar'])
                .reply(200, 'OK');

            client.addResourceGroup('waffles', ['foo', 'bar'], function(err, body, res) {
                assert.ifError(err, 'addResourceGroup should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#editResourceGroups', function() {
        it('should pass the passed resources on as request body', function(done) {
            mock.filteringPath(urlCleaner)
                .put('/groups/wat', ['image.get', 'user.options'])
                .reply(200);

            client.editResourceGroup('wat', ['image.get', 'user.options'], function(err, body, res) {
                assert.ifError(err, 'getResourceGroups should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .put('/groups/wat', ['image.get', 'user.options'])
                .reply(400, 'Permission denied (public key)');

            client.editResourceGroup('wat', ['image.get', 'user.options'], function(err, body, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#deleteResourceGroup', function() {
        it('should delete the passed resource group', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/groups/wat')
                .reply(200);

            client.deleteResourceGroup('wat', function(err, res) {
                assert.ifError(err, 'getResourceGroups should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/groups/wat')
                .reply(400, 'Permission denied (public key)');

            client.deleteResourceGroup('wat', function(err, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#resourceGroupExists', function() {
        it('should return true if the public key exists', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/ninja')
                .reply(200, 'OK');

            client.resourceGroupExists('ninja', function(err, exists) {
                assert.ifError(err, 'Resource group that exists should not give an error');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/groups/ninja')
                .reply(404, 'Resource group not found');

            client.resourceGroupExists('ninja', function(err, exists) {
                assert.ifError(err, 'resourceGroupExists should not fail when public key does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.resourceGroupExists('ninja', function(err) {
                assert.ok(err, 'resourceGroupExists should give error if host is unreachable');
                done();
            });
        });
    });

    describe('#addPublicKey', function() {
        it('should return error if public key already exists', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/waffle-mixture')
                .reply(200);

            client.addPublicKey('waffle-mixture', 'priv-key', function(err) {
                assert(err);
                assert(err.message.match(/already exists/));
                done();
            });
        });

        it('should return error if public key check fails', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/waffle-mixture')
                .reply(400, 'Permission denied (public key)');

            client.addPublicKey('waffle-mixture', 'priv-key', function(err) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/waffle-mixture')
                .reply(404);

            mock.filteringPath(urlCleaner)
                .put('/keys/waffle-mixture')
                .reply(400, 'Permission denied (public key)');

            client.addPublicKey('waffle-mixture', 'priv-key', function(err, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not give error on successful addition', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/waffle-mixture')
                .reply(404);

            mock.filteringPath(urlCleaner)
                .put('/keys/waffle-mixture', { privateKey: 'priv-key' })
                .reply(200, 'OK');

            client.addPublicKey('waffle-mixture', 'priv-key', function(err, res) {
                assert.ifError(err, 'addPublicKey should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#editPublicKey', function() {
        it('should throw if public key is not truthy', function() {
            assert.throws(function() {
                client.editPublicKey(null);
            }, /public key/);
        });

        it('should throw if public key is not truthy', function() {
            assert.throws(function() {
                client.editPublicKey('public-key', null);
            }, /private key/);
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .put('/keys/waffle-mixture')
                .reply(400, 'Permission denied (public key)');

            client.editPublicKey('waffle-mixture', 'priv-key', function(err, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });

        it('should not give error on successful edit', function(done) {
            mock.filteringPath(urlCleaner)
                .put('/keys/waffle-mixture', { privateKey: 'priv-key' })
                .reply(200, 'OK');

            client.editPublicKey('waffle-mixture', 'priv-key', function(err, res) {
                assert.ifError(err, 'addPublicKey should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#deletePublicKey', function() {
        it('should delete the passed public key', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/keys/wat')
                .reply(200);

            client.deletePublicKey('wat', function(err, res) {
                assert.ifError(err, 'deletePublicKey should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/keys/wat')
                .reply(400, 'Permission denied (public key)');

            client.deletePublicKey('wat', function(err, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#publicKeyExists', function() {
        it('should return true if the public key exists', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/ninja')
                .reply(200, 'OK');

            client.publicKeyExists('ninja', function(err, exists) {
                assert.ifError(err, 'Public key that exists should not give an error');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the identifier does not exist', function(done) {
            mock.filteringPath(urlCleaner)
                .head('/keys/ninja')
                .reply(404, 'Public key not found');

            client.publicKeyExists('ninja', function(err, exists) {
                assert.ifError(err, 'publicKeyExists should not fail when public key does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.publicKeyExists('ninja', function(err) {
                assert.ok(err, 'publicKeyExists should give error if host is unreachable');
                done();
            });
        });
    });

    describe('#getAccessControlRules', function() {
        it('should return an array of access control rules', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/keys/ninja/access')
                .reply(200, [
                    { id: 1, resources: ['foo', 'bar'], users: '*' }
                ]);

            client.getAccessControlRules('ninja', function(err, rules, res) {
                assert.ifError(err, 'getAccessControlRules should not give an error on success');
                assert.equal(1, rules.length);
                assert.equal('*', rules[0].users);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/keys/ninja/access')
                .reply(400, 'Permission denied (public key)');

            client.getAccessControlRules('ninja', function(err, rules, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#getAccessControlRule', function() {
        it('should return an array of resources', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/keys/ninja/access/1')
                .reply(200, { id: 1, resources: ['foo', 'bar'], users: '*' });

            client.getAccessControlRule('ninja', 1, function(err, rule, res) {
                assert.ifError(err, 'getAccessControlRule should not give an error on success');
                assert.equal(2, rule.resources.length);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .get('/keys/ninja/access/1')
                .reply(400, 'Permission denied (public key)');

            client.getAccessControlRule('ninja', 1, function(err, rule, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });

    describe('#addAccessControlRule', function() {
        it('should throw if public key is not truthy', function() {
            assert.throws(function() {
                client.addAccessControlRule(null);
            }, /public key/i);
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            var body = [{ users: '*', resources: ['waffle.make'] }];
            mock.filteringPath(urlCleaner)
                .post('/keys/waffle-mixture/access', body)
                .reply(400, 'Permission denied (public key)');

            client.addAccessControlRule(
                'waffle-mixture',
                body,
                function(err) {
                    assert(err);
                    assert(err.message.match(/\b400\b/));
                    done();
                }
            );
        });

        it('should not give error on successful edit', function(done) {
            var body = [{ users: '*', resources: ['waffle.make'] }];
            mock.filteringPath(urlCleaner)
                .post('/keys/waffle-mixture/access', body)
                .reply(200);

            client.addAccessControlRule(
                'waffle-mixture',
                body,
                function(err) {
                    assert.ifError(err, 'addAccessControlRule should not give an error on success');
                    done();
                }
            );
        });

        it('should wrap non-array rules in array', function(done) {
            var body = { users: '*', resources: ['waffle.make'] };
            mock.filteringPath(urlCleaner)
                .post('/keys/waffle-mixture/access', [body])
                .reply(200);

            client.addAccessControlRule('waffle-mixture', body, done);
        });
    });

    describe('#deleteAccessControlRule', function() {
        it('should delete the passed rule', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/keys/wat/access/1')
                .reply(200);

            client.deleteAccessControlRule('wat', 1, function(err, res) {
                assert.ifError(err, 'deleteAccessControlRule should not give an error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the public key does not have sufficient privileges', function(done) {
            mock.filteringPath(urlCleaner)
                .delete('/keys/wat/access/1')
                .reply(400, 'Permission denied (public key)');

            client.deleteAccessControlRule('wat', 1, function(err, res) {
                assert(err);
                assert(err.message.match(/\b400\b/));
                assert.equal(400, res.statusCode);
                done();
            });
        });
    });
});

function getNock() {
    return require('nock');
}
