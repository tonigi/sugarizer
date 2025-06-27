define(["sugar-web/activity/activity"], function (activity) {
    requirejs(['domReady!'], function () {
        activity.setup();

        var letterElem = document.getElementById('letter');
        var progressElem = document.getElementById('progress');
        var messageElem = document.getElementById('message');

        var duration = 3000; // ms
        var timer = null;
        var progressTimer = null;
        var currentLetter = '';
        var waitingForNextRound = false;

        function startRound() {
            waitingForNextRound = false;
            messageElem.textContent = '';
            messageElem.className = '';
            currentLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            letterElem.textContent = currentLetter;
            progressElem.style.width = '100%';
            var startTime = Date.now();
            if (progressTimer) clearInterval(progressTimer);
            progressTimer = setInterval(function() {
                var elapsed = Date.now() - startTime;
                var ratio = 1 - elapsed / duration;
                if (ratio < 0) ratio = 0;
                progressElem.style.width = (ratio * 100) + '%';
                if (ratio <= 0) {
                    endRound(false);
                }
            }, 50);
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() {
                endRound(false);
            }, duration);
        }

        function endRound(success) {
            clearTimeout(timer);
            clearInterval(progressTimer);
            if (success) {
                new Audio('audio/applause.mp3').play();
                messageElem.textContent = 'Great!';
                messageElem.className = 'success';
            } else {
                new Audio('audio/disappointed.mp3').play();
                messageElem.textContent = 'Try again';
                messageElem.className = 'fail';
            }
            waitingForNextRound = true;
            currentLetter = '';
            messageElem.textContent += ' Press any key to start again.';
        }

        document.addEventListener('keydown', function(event) {
            if (waitingForNextRound) {
                startRound();
                return;
            }
            if (!currentLetter) return;
            var key = event.key.toUpperCase();
            if (key === currentLetter) {
                endRound(true);
            }
        });

        startRound();
    });
});
