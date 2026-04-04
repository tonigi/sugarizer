define(["sugar-web/env"], function(env) {
    var useEspeak = false; // Switch between eSpeak and standard speech synthesis

    var userLanguage = (navigator.language || 'en').substr(0,2);
    var voices = [];
    var configDone = false;

    function loadVoices() {
        if ('speechSynthesis' in window) {
            voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) {
                window.speechSynthesis.onvoiceschanged = function() {
                    voices = window.speechSynthesis.getVoices();
                };
            }
        }
    }
    loadVoices();

    env.getEnvironment(function(err, environment) {
        var defaultLanguage = (typeof window.chrome !== 'undefined' && window.chrome.app && window.chrome.app.runtime) ? window.chrome.i18n.getUILanguage() : navigator.language;
        if (!environment.user) {
            environment.user = { language: defaultLanguage };
        }
        userLanguage = environment.user.language;
    });

    function speak(text, language) {
        if (useEspeak) {
            if (!configDone) {
                configDone = true;
                meSpeak.loadConfig("../Speak.activity/mespeak_config.json");
            }
            if (!language) {
                language = userLanguage;
            }
            meSpeak.loadVoice("../Speak.activity/voices/" + language + ".json", function() {
                meSpeak.speak(text);
            });
        } else {
            if (!('speechSynthesis' in window)) {
                console.error("Web Speech API not supported");
                return;
            }
            var utterance = new SpeechSynthesisUtterance(text);
            var lang = language || userLanguage;
            utterance.lang = lang;
            if (voices.length > 0) {
                var voice = voices.find(function(v) { return v.lang.startsWith(lang); });
                if (voice) {
                    utterance.voice = voice;
                }
            }
            window.speechSynthesis.speak(utterance);
        }
    }

    function toggleEngine() {
        useEspeak = !useEspeak;
        return useEspeak;
    }

    return {
        speak: speak,
        toggleEngine: toggleEngine
    };
});