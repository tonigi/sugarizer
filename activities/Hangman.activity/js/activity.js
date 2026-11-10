define(["sugar-web/activity/activity", "sugar-web/env", "activity/speech"], function (activity, env, speech) {

        var wordLists = {};
        var level = 'easy';
        var LEVELS = ['easy', 'medium', 'hard'];
        var word, guessed, attempts;

        function loadWords(callback) {
            var lang = (navigator.language || 'en').substr(0,2).toLowerCase();
            var file = (lang === 'it') ? 'words_it.json' : 'words_en.json';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', file, true);
            xhr.onload = function () {
                // status is 0 for file:// URLs (Electron/Cordova)
                if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
                    wordLists = JSON.parse(xhr.responseText);
                    callback();
                }
            };
            xhr.send();
        }

        function setLevel(newLevel, restart) {
            if (LEVELS.indexOf(newLevel) === -1) return;
            level = newLevel;
            LEVELS.forEach(function (l) {
                document.getElementById('level-' + l).classList.toggle('active', l === level);
            });
            if (restart && wordLists[level]) newGame();
        }

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
                        status.textContent = 'You win! 😊';
                        status.className = 'win';
                        speech.speak('You win');
                        new Audio('audio/applause.mp3').play();
                } else if (attempts <= 0) {
                        status.textContent = 'Game over: ' + word + ' 😞';
                        status.className = 'lose';
                        speech.speak('Game over ' + word);
                        new Audio('audio/disappointed.mp3').play();
                }
        }

        function newGame() {
                var words = wordLists[level];
                word = words[Math.floor(Math.random()*words.length)];
                guessed = [];
                attempts = 6;
                var status = document.getElementById('status');
                status.textContent = '';
                status.className = '';
                updateDisplay();
                speech.speak("La parola da scrivere è: "+word+". "+word);
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
                document.getElementById('new-btn').addEventListener('click', newGame);
                document.getElementById('respeak-btn').addEventListener('click', function() {
                  speech.speak(word);
                });
                document.getElementById('espeak-btn').addEventListener('click', function() {
                  var espeakOn = speech.toggleEngine();
                  document.getElementById('espeak-btn').style.backgroundColor = espeakOn ? '#f00' : '#fff';
                });
                LEVELS.forEach(function (l) {
                  document.getElementById('level-' + l).addEventListener('click', function () {
                    setLevel(l, true);
                  });
                });
                document.getElementById('stop-button').addEventListener('click', function () {
                  activity.getDatastoreObject().setDataAsText(JSON.stringify({ level: level }));
                  activity.getDatastoreObject().save();
                });
                setLevel(level, false);
                env.getEnvironment(function (err, environment) {
                  if (environment && environment.objectId) {
                    activity.getDatastoreObject().loadAsText(function (error, metadata, data) {
                      if (!error && data) {
                        try { setLevel(JSON.parse(data).level, true); } catch (e) {}
                      }
                    });
                  }
                });
                window.addEventListener('keydown', function(e) {
                        guess(e.key);
                });
                loadWords(newGame);
        });

});