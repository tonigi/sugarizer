define(["sugar-web/activity/activity"], function (activity) {

	// Manipulate the DOM only when it is ready.
	requirejs(['domReady!'], function (doc) {

		// Initialize the activity.
		activity.setup();

		var synth = window.speechSynthesis;
		var startTime = Date.now();
		var voices = [];
		var voiceEvents = 0;
		var firstVoicesAt = null;

		var $ = function (id) { return document.getElementById(id); };

		function log(msg) {
			var t = ((Date.now() - startTime) / 1000).toFixed(2);
			var el = $("log");
			el.textContent += "[" + t + "s] " + msg + "\n";
			el.scrollTop = el.scrollHeight;
		}

		// Environment table
		function renderEnv() {
			var rows = [
				["User agent", navigator.userAgent],
				["Platform", navigator.platform],
				["navigator.language", navigator.language],
				["navigator.languages", (navigator.languages || []).join(", ")],
				["speechSynthesis", synth ? "available" : "NOT available"],
				["SpeechSynthesisUtterance", ("SpeechSynthesisUtterance" in window) ? "available" : "NOT available"],
				["Voices reported", voices.length],
				["voiceschanged events", voiceEvents],
				["First voices after", firstVoicesAt === null ? "never" : firstVoicesAt + " s"],
				["speaking / pending / paused", synth ? [synth.speaking, synth.pending, synth.paused].join(" / ") : "-"]
			];
			var table = $("env");
			table.innerHTML = "";
			rows.forEach(function (r) {
				var tr = document.createElement("tr");
				var th = document.createElement("th");
				var td = document.createElement("td");
				th.textContent = r[0];
				td.textContent = r[1];
				tr.appendChild(th);
				tr.appendChild(td);
				table.appendChild(tr);
			});
		}

		// Speak a text with a specific voice (or the engine default when voice is null)
		function speak(voice) {
			if (!synth) {
				log("speechSynthesis not available");
				return;
			}
			var u = new SpeechSynthesisUtterance($("text").value);
			if (voice) {
				u.voice = voice;
				u.lang = voice.lang;
			} else if ($("lang-filter").value) {
				u.lang = $("lang-filter").value;
			}
			u.rate = parseFloat($("rate").value);
			u.pitch = parseFloat($("pitch").value);
			u.volume = parseFloat($("volume").value);
			var label = voice ? voice.name + " (" + voice.lang + ")" : "default voice";
			var t0 = 0;
			u.onstart = function () { t0 = Date.now(); log("start: " + label); };
			u.onend = function () { log("end: " + label + (t0 ? " in " + (Date.now() - t0) + " ms" : "")); };
			u.onerror = function (e) { log("ERROR: " + label + " -> " + e.error); };
			log("speak: " + label + ", rate=" + u.rate + ", pitch=" + u.pitch + ", volume=" + u.volume);
			synth.speak(u);
		}

		// Voices table
		function renderVoices() {
			var filter = $("lang-filter").value.trim().toLowerCase();
			var tbody = document.querySelector("#voices tbody");
			tbody.innerHTML = "";
			var shown = voices.filter(function (v) {
				return !filter || v.lang.toLowerCase().indexOf(filter) === 0;
			});
			shown.forEach(function (v) {
				var tr = document.createElement("tr");
				var btnCell = document.createElement("td");
				var btn = document.createElement("button");
				btn.className = "play";
				btn.title = "Speak with this voice";
				btn.addEventListener("click", function () { speak(v); });
				btnCell.appendChild(btn);
				tr.appendChild(btnCell);
				[v.name, v.lang, v.localService ? "yes" : "no (remote)", v.default ? "yes" : "", v.voiceURI].forEach(function (txt) {
					var td = document.createElement("td");
					td.textContent = txt;
					tr.appendChild(td);
				});
				tbody.appendChild(tr);
			});
			$("voice-count").textContent = "(" + shown.length + (filter ? " of " + voices.length : "") + ")";
			$("no-voices").hidden = voices.length > 0;
			renderEnv();
		}

		function loadVoices(reason) {
			if (!synth) {
				renderVoices();
				return;
			}
			voices = synth.getVoices();
			if (voices.length && firstVoicesAt === null) {
				firstVoicesAt = ((Date.now() - startTime) / 1000).toFixed(2);
			}
			log("getVoices (" + reason + "): " + voices.length + " voice(s)");
			renderVoices();
		}

		// Plain-text report, for pasting in a bug report
		function buildReport() {
			var lines = [];
			lines.push("Voice Debug report");
			lines.push("UA: " + navigator.userAgent);
			lines.push("Platform: " + navigator.platform + ", language: " + navigator.language);
			lines.push("Voices: " + voices.length + " (voiceschanged events: " + voiceEvents + ")");
			voices.forEach(function (v) {
				lines.push([v.name, v.lang, v.localService ? "local" : "remote", v.default ? "default" : "", v.voiceURI].join(" | "));
			});
			lines.push("");
			lines.push("Log:");
			lines.push($("log").textContent);
			return lines.join("\n");
		}

		function copyReport() {
			var text = buildReport();
			var fallback = function () {
				var ta = document.createElement("textarea");
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				try { document.execCommand("copy"); log("report copied (fallback)"); } catch (e) { log("copy failed: " + e); }
				document.body.removeChild(ta);
			};
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () { log("report copied"); }, fallback);
			} else {
				fallback();
			}
		}

		// Wire UI
		["rate", "pitch", "volume"].forEach(function (id) {
			$(id).addEventListener("input", function () { $(id + "-out").textContent = $(id).value; });
		});
		$("lang-filter").addEventListener("input", renderVoices);
		$("refresh-button").addEventListener("click", function () { loadVoices("manual reload"); });
		$("cancel-button").addEventListener("click", function () { if (synth) { synth.cancel(); log("cancel"); } });
		$("copy-button").addEventListener("click", copyReport);

		if (synth) {
			synth.onvoiceschanged = function () {
				voiceEvents++;
				loadVoices("voiceschanged");
			};
		} else {
			log("window.speechSynthesis is not available");
		}
		loadVoices("startup");
		// Some engines report voices late and without an event: poll briefly
		var tries = 0;
		var poll = setInterval(function () {
			if (voices.length || ++tries > 10) {
				clearInterval(poll);
				return;
			}
			loadVoices("poll " + tries);
		}, 500);

	});

});
