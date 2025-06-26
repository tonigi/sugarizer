define(["sugar-web/activity/activity"], function (activity) {

        var words = ["SUGAR", "LEARNING", "HANGMAN", "COMPUTER", "JAVASCRIPT"];
        var word, guessed, attempts;

        function updateDisplay() {
                var display = word.split('').map(function (ch) {
                        return guessed.indexOf(ch) !== -1 ? ch : '_';
                }).join(' ');
                document.getElementById('display-word').textContent = display;
                document.getElementById('used-letters').textContent = guessed.join(' ');
        }

        function checkResult() {
                if (word.split('').every(function(ch){ return guessed.indexOf(ch) !== -1; })) {
                        document.getElementById('status').textContent = 'You win!';
                } else if (attempts <= 0) {
                        document.getElementById('status').textContent = 'Game over: ' + word;
                }
        }

        function newGame() {
                word = words[Math.floor(Math.random()*words.length)];
                guessed = [];
                attempts = 6;
                document.getElementById('status').textContent = '';
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
                newGame();
        });

});