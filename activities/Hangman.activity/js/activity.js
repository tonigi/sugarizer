define(["sugar-web/activity/activity"], function (activity) {

        var words = [];
        var word, guessed, attempts;

        function loadWords(callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'words.txt', true);
            xhr.onload = function () {
                if (xhr.status === 200) {
                    words = xhr.responseText.split('\n').filter(function(word) { return word.length > 0; });
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
                        status.textContent = 'You win! 😊';
                        status.className = 'win';
                } else if (attempts <= 0) {
                        status.textContent = 'Game over: ' + word + ' 😞';
                        status.className = 'lose';
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
        }

        function guess(letter) {
                letter = letter.toUpperCase();
                if (!letter.match(/^[A-Z]$/) || guessed.indexOf(letter) !== -1) return;
                guessed.push(letter);
                if (word.indexOf(letter) === -1) attempts--;
                updateDisplay();
                checkResult();
        }

        requirejs(['domReady!'], function () {
                activity.setup();
                document.getElementById('new-btn').addEventListener('click', newGame);
                window.addEventListener('keydown', function(e) {
                        guess(e.key);
                });
                loadWords(newGame);
        });

});