define(["sugar-web/activity/activity", "sugar-web/env", "activity/speech", "l10n"], function (activity, env, speech, l10n) {

        var words = [];
        var word, guessed, attempts;

        function loadWords(callback) {
            var lang = (navigator.language || 'en').substr(0,2).toLowerCase();
            var file = (lang === 'it') ? 'words_it.txt' : 'words_en.txt';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', file, true);
            xhr.onload = function () {
                if (xhr.status === 200) {
                    words = xhr.responseText.split('\n').filter(function(word) {
                        return word.length > 0;
                    });
                    callback();
                }
            };
            xhr.send();
        }


        var word, guessed, attempts;

        function updateDisplay() {
                var display = word.split('').map(function (ch) {
                        return guessed.indexOf(ch) !== -1 ? ch : '_';
                }).join(' ');
                document.getElementById('display-word').textContent = display;
                document.getElementById('used-letters').textContent = guessed.join(' ');
        }

        function checkResult() {
                var status = document.getElementById('status');
                if (word.split('').every(function(ch){ return guessed.indexOf(ch) !== -1; })) {
                        status.textContent = l10n.get('YouWin') + ' 😊';
                        status.className = 'win';
                        speech.speak(l10n.get('YouWin'));
                } else if (attempts <= 0) {
                        status.textContent = l10n.get('GameOver', {word: word}) + ' 😞';
                        status.className = 'lose';
                        speech.speak(l10n.get('GameOver', {word: word}));
                }
        }

        function newGame() {
                word = words[Math.floor(Math.random()*words.length)];
                guessed = [];
                attempts = 6;
                var status = document.getElementById('status');
                status.textContent = '';
                status.className = '';
                updateDisplay();
                speech.speak(l10n.get('NewGame'));
        }

        function guess(letter) {
                letter = letter.toUpperCase();
                if (!letter.match(/^[A-Z]$/) || guessed.indexOf(letter) !== -1) return;
                guessed.push(letter);
                if (word.indexOf(letter) === -1) attempts--;
                speech.speak(letter);
                updateDisplay();
                checkResult();
        }

        requirejs(['domReady!'], function () {
                activity.setup();
                env.getEnvironment(function(err, environment) {
                        var defaultLanguage = (typeof chrome != 'undefined' && chrome.app && chrome.app.runtime) ? chrome.i18n.getUILanguage() : navigator.language;
                        var language = environment.user ? environment.user.language : defaultLanguage;
                        l10n.init(language);
                });
                document.getElementById('new-btn').addEventListener('click', newGame);
                window.addEventListener('keydown', function(e) {
                        guess(e.key);
                });
                loadWords(newGame);
        });

});