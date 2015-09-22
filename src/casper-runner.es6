'use strict';

/* globals patchRequire,casper */

var require = patchRequire(require), // jshint ignore:line
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    options = _.merge({ // Merge default options and cli options
        'file': null,
        'selectors': null,
        'dirname': path.join(fs.workingDirectory, 'node_modules')
    }, casper.cli.options, (a, b) => {
        if (b === 'undefined') {
            return null;
        }
    }),
    phantomcssPath = path.join(options.dirname, '..', '/node_modules/phantomcss'),
    phantomcss = require(phantomcssPath + '/phantomcss'),
    screenshotDir = '/screenshots',
    failedDir = screenshotDir + '/failed',
    resultsDir = screenshotDir + '/results';

// log error messages to the console
function logError(message) {
    console.error(message);
}

// log messages to the console
function log(message) {
    console.log(message);
}

function exit(msg, code = 0) {
    if (msg) {
        if (code === 0) {
            log(msg);
        } else {
            logError(msg);
        }
    }
    return casper.exit(code);
}

function initPhantomCSS(dirPath) {
    let screenshotRoot = dirPath + screenshotDir,
        failedComparisonsRoot = dirPath + failedDir;

    // Remove failed directory if any
    fs.removeTree(failedComparisonsRoot);

    // Initialize phantomCSS
    phantomcss.init({
        casper: casper,
        cleanupComparisonImages: true,
        comparisonResultRoot: dirPath + resultsDir,
        libraryRoot: phantomcssPath,
        screenshotRoot: screenshotRoot,
        failedComparisonsRoot: failedComparisonsRoot,
        addLabelToFailedImage: false,
        mismatchTolerance: 0.00001
    });
}

function takeFullScreenshot(screenshotName) {
    phantomcss.screenshot('*', screenshotName);
}

function getClassNamesToCapture(selectors) {
    // convert the selectors to an array
    selectors = selectors.split(',');

    let classNames = [];

    selectors.forEach(selector => {
        let domNodes = Array.prototype.map.call(document.querySelectorAll(selector), node => node);
        // populate the class names
        domNodes.forEach((element, index) => {
            let className =  'modshot-' + index;
            element.setAttribute('class', element.getAttribute('class') + ' ' + className);
            classNames.push(className);
        });
    });

    return classNames;
}

function takeSelectorScreenshot(screenshotName, classNames) {
    // Take screenshot for all the class names
    classNames.forEach((className, index) => {
        phantomcss.screenshot('.' + className, screenshotName + '-' + index);
    });
}

function compareScreenshot() {
    phantomcss.compareSession();
}

function run() {

    let file = options.file;
    if (!file) {
        exit('Please provide a html file path to continue', 1);
        return;
    }
    let fileDir = path.dirname(file);

    // Initialize PhantomCSS
    initPhantomCSS(fileDir);

    casper.test.begin('Visual testing - ' + options.file, test => {
        casper.start(file);

        // Set the viewport
        casper.viewport(1024, 768);

        // Take screenshot
        let screenshotName = path.basename(file, '.html');
        if (options.selectors) {
            casper.then(() => {
                let classNames = casper.evaluate(getClassNamesToCapture, options.selectors);
                takeSelectorScreenshot(screenshotName, classNames);
            });
        } else {
            casper.then(takeFullScreenshot.bind(undefined, screenshotName));
        }

        // Compare screenshot
        casper.then(compareScreenshot);

        // Run & wrap up the test
        casper.run(() => {
            // Clean up the results dir
            fs.removeTree(fileDir + resultsDir);

            log('Finished visual testing for - ' + file);
            test.done();
            // Calling exit to prevent unsafe JavaScript error https://github.com/n1k0/casperjs/issues/1068
            casper.exit();
        });
    });
}

// Start the run
run();
