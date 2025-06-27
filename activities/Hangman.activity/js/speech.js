define(["sugar-web/env"], function(env) {
    var configDone = false;
    var userLanguage = (navigator.language || 'en').substr(0,2);

    env.getEnvironment(function(err, environment) {
        var defaultLanguage = (typeof window.chrome !== 'undefined' && window.chrome.app && window.chrome.app.runtime) ? window.chrome.i18n.getUILanguage() : navigator.language;
        if (!environment.user) {
            environment.user = { language: defaultLanguage };
        }
        userLanguage = environment.user.language;
    });

    function speak(text, language) {
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
    }

    return {
        speak: speak
    };
});
