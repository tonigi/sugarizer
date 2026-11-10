define(["sugar-web/activity/activity", "sugar-web/env", "sugar-web/graphics/presencepalette", "l10n", "tutorial"], function (activity, env, presencepalette, l10n, tutorial) {

	requirejs(['domReady!'], function (doc) {
		activity.setup();

		// --- Constants ---
		var COLS = 7;
		var ROWS = 6;
		var COLORS = {1: "#e03a3a", 2: "#f5c518"};
		var COLOR_NAMES = {1: "Red", 2: "Yellow"};
		var BOARD_COLOR = "#2457b8";
		var BOARD_EDGE = "#173a82";
		var BACKGROUND = "#c0c0c0";
		var AI_DEPTH = 5;
		var COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];
		var BUNDLE_ID = "org.sugarlabs.Connect4Activity";

		// --- Game state ---
		var board;			// board[row][col], row 0 is the top. 0 = empty, 1 or 2 = player
		var turn;			// player to move: 1 (starts) or 2
		var over;			// 0 = playing, 1 or 2 = winner, 3 = draw
		var winLine;		// cells of the winning four
		var mode = "ai";	// "ai" (human is 1), "two" (hot seat) or "net" (shared)
		var myPlayer = 1;	// network mode only
		var opponentPresent = false;
		var isHost = false;
		var presence = null;
		var animation = null;	// {row, col, player, start}
		var hoverCol = -1;
		var aiTimer = null;

		// --- Board logic ---
		function emptyBoard() {
			var b = [];
			for (var r = 0; r < ROWS; r++) {
				b.push(new Array(COLS).fill(0));
			}
			return b;
		}

		function dropRow(b, col) {
			for (var r = ROWS - 1; r >= 0; r--) {
				if (b[r][col] === 0) {
					return r;
				}
			}
			return -1;
		}

		var DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

		// Returns the winning cells through (row, col), or null
		function winAt(b, row, col, p) {
			for (var d = 0; d < DIRECTIONS.length; d++) {
				var dr = DIRECTIONS[d][0], dc = DIRECTIONS[d][1];
				var line = [[row, col]];
				for (var s = -1; s <= 1; s += 2) {
					var r = row + dr * s, c = col + dc * s;
					while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b[r][c] === p) {
						line.push([r, c]);
						r += dr * s;
						c += dc * s;
					}
				}
				if (line.length >= 4) {
					return line;
				}
			}
			return null;
		}

		function isFull(b) {
			for (var c = 0; c < COLS; c++) {
				if (b[0][c] === 0) {
					return false;
				}
			}
			return true;
		}

		// --- Computer player (negamax with alpha-beta pruning) ---
		function evaluate(b, p) {
			var score = 0;
			var q = 3 - p;
			for (var r = 0; r < ROWS; r++) {
				if (b[r][3] === p) { score += 3; } else if (b[r][3] === q) { score -= 3; }
			}
			for (var d = 0; d < DIRECTIONS.length; d++) {
				var dr = DIRECTIONS[d][0], dc = DIRECTIONS[d][1];
				for (var r0 = 0; r0 < ROWS; r0++) {
					for (var c0 = 0; c0 < COLS; c0++) {
						var r1 = r0 + dr * 3, c1 = c0 + dc * 3;
						if (r1 < 0 || r1 >= ROWS || c1 < 0 || c1 >= COLS) {
							continue;
						}
						var mine = 0, theirs = 0;
						for (var k = 0; k < 4; k++) {
							var v = b[r0 + dr * k][c0 + dc * k];
							if (v === p) { mine++; } else if (v === q) { theirs++; }
						}
						if (mine && theirs) {
							continue;
						}
						if (mine === 3) { score += 5; } else if (mine === 2) { score += 2; }
						if (theirs === 3) { score -= 5; } else if (theirs === 2) { score -= 2; }
					}
				}
			}
			return score;
		}

		function negamax(b, depth, alpha, beta, p) {
			var best = -Infinity;
			var any = false;
			for (var i = 0; i < COLUMN_ORDER.length; i++) {
				var c = COLUMN_ORDER[i];
				var r = dropRow(b, c);
				if (r < 0) {
					continue;
				}
				any = true;
				b[r][c] = p;
				var s;
				if (winAt(b, r, c, p)) {
					s = 1000 + depth;
				} else if (depth <= 1) {
					s = evaluate(b, p);
				} else {
					s = -negamax(b, depth - 1, -beta, -alpha, 3 - p);
				}
				b[r][c] = 0;
				if (s > best) { best = s; }
				if (best > alpha) { alpha = best; }
				if (alpha >= beta) { break; }
			}
			return any ? best : 0;
		}

		function chooseAIMove(p) {
			var scores = [];
			var best = -Infinity;
			for (var c = 0; c < COLS; c++) {
				var r = dropRow(board, c);
				if (r < 0) {
					scores.push(null);
					continue;
				}
				board[r][c] = p;
				var s = winAt(board, r, c, p) ? 1000 + AI_DEPTH : -negamax(board, AI_DEPTH - 1, -Infinity, Infinity, 3 - p);
				board[r][c] = 0;
				scores.push(s);
				if (s > best) { best = s; }
			}
			var candidates = [];
			for (c = 0; c < COLS; c++) {
				if (scores[c] === best) {
					candidates.push(c);
				}
			}
			return candidates[Math.floor(Math.random() * candidates.length)];
		}

		// --- Moves ---
		function newGame() {
			clearTimeout(aiTimer);
			board = emptyBoard();
			turn = 1;
			over = 0;
			winLine = null;
			animation = null;
			requestDraw();
		}

		// Apply a move for the player to move; returns false if the move is illegal
		function applyMove(col) {
			if (over || col < 0 || col >= COLS) {
				return false;
			}
			var row = dropRow(board, col);
			if (row < 0) {
				return false;
			}
			var p = turn;
			board[row][col] = p;
			animation = {row: row, col: col, player: p, start: performance.now()};
			var line = winAt(board, row, col, p);
			if (line) {
				over = p;
				winLine = line;
			} else if (isFull(board)) {
				over = 3;
			} else {
				turn = 3 - p;
			}
			requestDraw();
			scheduleAI();
			return true;
		}

		function scheduleAI() {
			clearTimeout(aiTimer);
			if (mode === "ai" && !over && turn === 2) {
				aiTimer = setTimeout(function () {
					applyMove(chooseAIMove(2));
				}, 700);
			}
		}

		function canPlay() {
			// A finished drop must not block input even if no frame was drawn since
			if (animation && fallY(animation, performance.now()) === null) {
				animation = null;
			}
			if (over || animation) {
				return false;
			}
			if (mode === "ai") {
				return turn === 1;
			}
			if (mode === "net") {
				return opponentPresent && turn === myPlayer;
			}
			return true;
		}

		function playColumn(col) {
			if (!canPlay()) {
				return;
			}
			if (applyMove(col) && mode === "net" && presence) {
				presence.sendMessage(presence.getSharedInfo().id, {
					user: presence.getUserInfo(),
					action: "move",
					col: col
				});
			}
		}

		// --- Rendering ---
		var canvas = document.getElementById("board");
		var ctx = canvas.getContext("2d");
		var cell, boardX, boardY, statusY, previewY, dpr = 1;
		var drawPending = false;

		function resize() {
			var container = document.getElementById("canvas");
			var w = container.clientWidth;
			var h = container.clientHeight;
			dpr = window.devicePixelRatio || 1;
			canvas.style.width = w + "px";
			canvas.style.height = h + "px";
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			// Vertical layout: status (0.5 cell), preview row (1 cell), board (ROWS cells)
			cell = Math.max(10, Math.floor(Math.min(w / (COLS + 0.5), h / (ROWS + 1.9))));
			boardX = Math.floor((w - cell * COLS) / 2);
			var totalH = cell * (ROWS + 1.5);
			var top = Math.max(0, Math.floor((h - totalH) / 2));
			statusY = top + cell * 0.25;
			previewY = top + cell * 0.5;
			boardY = previewY + cell;
			requestDraw();
		}

		function statusText() {
			if (over === 3) {
				return l10n.get("Draw");
			}
			if (over) {
				if (mode === "ai") {
					return over === 1 ? l10n.get("YouWin") : l10n.get("ComputerWins");
				}
				if (mode === "net") {
					return over === myPlayer ? l10n.get("YouWin") : l10n.get("YouLose");
				}
				return l10n.get("PlayerWins", {player: l10n.get(COLOR_NAMES[over])});
			}
			if (mode === "ai") {
				return turn === 1 ? l10n.get("YourTurn") : l10n.get("ComputerThinking");
			}
			if (mode === "net") {
				if (!opponentPresent) {
					return l10n.get("WaitingOpponent");
				}
				return turn === myPlayer ? l10n.get("YourTurn") : l10n.get("OpponentTurn");
			}
			return l10n.get("PlayerTurn", {player: l10n.get(COLOR_NAMES[turn])});
		}

		function disc(x, y, radius, color) {
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		}

		function fallY(a, now) {
			// Free fall to the row, with a small bounce at the end
			var target = boardY + (a.row + 0.5) * cell;
			var from = previewY + cell * 0.5;
			var duration = 180 + 70 * a.row;
			var t = (now - a.start) / duration;
			if (t >= 1) {
				return null;
			}
			return from + (target - from) * t * t;
		}

		function draw() {
			drawPending = false;
			var now = performance.now();
			var w = canvas.width / dpr;
			var h = canvas.height / dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);

			// Status line
			var fontSize = Math.max(14, Math.floor(cell * 0.32));
			ctx.font = "bold " + fontSize + "px 'Helvetica Neue', Helvetica, Arial, sans-serif";
			ctx.textBaseline = "middle";
			ctx.textAlign = "left";
			var text = statusText();
			var textW = ctx.measureText(text).width;
			var discR = fontSize * 0.5;
			var totalW = textW + (over === 3 ? 0 : discR * 2 + 10);
			var x = (w - totalW) / 2;
			var y = statusY + cell * 0.25;
			if (over !== 3) {
				disc(x + discR, y, discR, COLORS[over || turn]);
				x += discR * 2 + 10;
			}
			ctx.fillStyle = "#282828";
			ctx.fillText(text, x, y);

			// Preview disc above the hovered column
			if (hoverCol >= 0 && canPlay() && dropRow(board, hoverCol) >= 0) {
				ctx.globalAlpha = 0.7;
				disc(boardX + (hoverCol + 0.5) * cell, previewY + cell * 0.5, cell * 0.38, COLORS[mode === "net" ? myPlayer : turn]);
				ctx.globalAlpha = 1;
			}

			// Falling disc
			var animating = false;
			var fallingRow = -1, fallingCol = -1;
			if (animation) {
				var fy = fallY(animation, now);
				if (fy === null) {
					animation = null;
				} else {
					animating = true;
					fallingRow = animation.row;
					fallingCol = animation.col;
					disc(boardX + (animation.col + 0.5) * cell, fy, cell * 0.38, COLORS[animation.player]);
				}
			}

			// Board: discs go behind the blue plate, holes are cut out of it
			// Draw the discs first so the plate overlays them
			var r, c;
			for (r = 0; r < ROWS; r++) {
				for (c = 0; c < COLS; c++) {
					if (board[r][c] && !(r === fallingRow && c === fallingCol)) {
						disc(boardX + (c + 0.5) * cell, boardY + (r + 0.5) * cell, cell * 0.4, COLORS[board[r][c]]);
					}
				}
			}
			ctx.fillStyle = BOARD_COLOR;
			ctx.strokeStyle = BOARD_EDGE;
			ctx.lineWidth = Math.max(2, cell * 0.06);
			var radius = cell * 0.12;
			ctx.beginPath();
			ctx.roundRect(boardX, boardY, cell * COLS, cell * ROWS, radius);
			for (r = 0; r < ROWS; r++) {
				for (c = 0; c < COLS; c++) {
					var cx = boardX + (c + 0.5) * cell;
					var cy = boardY + (r + 0.5) * cell;
					ctx.moveTo(cx + cell * 0.38, cy);
					ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2, true);
				}
			}
			ctx.fill("evenodd");
			ctx.beginPath();
			ctx.roundRect(boardX, boardY, cell * COLS, cell * ROWS, radius);
			ctx.stroke();

			// Highlight the winning four
			if (winLine && !animating) {
				var pulse = 0.5 + 0.5 * Math.sin(now / 200);
				ctx.lineWidth = Math.max(3, cell * 0.08);
				ctx.strokeStyle = "rgba(255, 255, 255, " + (0.5 + 0.5 * pulse) + ")";
				for (var i = 0; i < winLine.length; i++) {
					ctx.beginPath();
					ctx.arc(boardX + (winLine[i][1] + 0.5) * cell, boardY + (winLine[i][0] + 0.5) * cell, cell * 0.4, 0, Math.PI * 2);
					ctx.stroke();
				}
			}

			if (animating || winLine) {
				requestDraw();
			}
		}

		function requestDraw() {
			if (!drawPending) {
				drawPending = true;
				requestAnimationFrame(draw);
			}
		}

		function columnAt(event) {
			var rect = canvas.getBoundingClientRect();
			var col = Math.floor((event.clientX - rect.left - boardX) / cell);
			return (col >= 0 && col < COLS) ? col : -1;
		}

		canvas.addEventListener("pointerdown", function (event) {
			var col = columnAt(event);
			hoverCol = col;
			if (col >= 0) {
				playColumn(col);
			}
		});
		canvas.addEventListener("pointermove", function (event) {
			var col = columnAt(event);
			if (col !== hoverCol) {
				hoverCol = col;
				requestDraw();
			}
		});
		canvas.addEventListener("pointerleave", function () {
			hoverCol = -1;
			requestDraw();
		});
		window.addEventListener("resize", resize);

		// --- Toolbar ---
		function updateToolbar() {
			var modeButton = document.getElementById("mode-button");
			modeButton.classList.toggle("two-players", mode === "two");
			modeButton.title = l10n.get(mode === "two" ? "ModeTwo" : "ModeComputer");
			modeButton.style.display = (mode === "net") ? "none" : "";
			document.getElementById("restart-button").title = l10n.get("NewGame");
		}

		function setMode(newMode) {
			mode = newMode;
			updateToolbar();
		}

		document.getElementById("mode-button").addEventListener("click", function () {
			setMode(mode === "ai" ? "two" : "ai");
			newGame();
		});

		document.getElementById("restart-button").addEventListener("click", function () {
			newGame();
			if (mode === "net" && presence) {
				presence.sendMessage(presence.getSharedInfo().id, {
					user: presence.getUserInfo(),
					action: "restart"
				});
			}
		});

		document.getElementById("help-button").addEventListener("click", function () {
			tutorial.start();
		});

		document.getElementById("fullscreen-button").addEventListener("click", function () {
			document.getElementById("main-toolbar").style.opacity = 0;
			document.getElementById("canvas").style.top = "0px";
			document.getElementById("unfullscreen-button").style.visibility = "visible";
			resize();
		});

		document.getElementById("unfullscreen-button").addEventListener("click", function () {
			document.getElementById("main-toolbar").style.opacity = 1;
			document.getElementById("canvas").style.top = "55px";
			document.getElementById("unfullscreen-button").style.visibility = "hidden";
			resize();
		});

		window.addEventListener("localized", function () {
			updateToolbar();
			requestDraw();
		});

		// --- Network ---
		function serializeState() {
			return {board: board, turn: turn, over: over, winLine: winLine};
		}

		function restoreState(state) {
			clearTimeout(aiTimer);
			board = state.board;
			turn = state.turn;
			over = state.over;
			winLine = state.winLine || null;
			animation = null;
			requestDraw();
		}

		function onNetworkDataReceived(msg) {
			if (presence.getUserInfo().networkId === msg.user.networkId) {
				return;
			}
			switch (msg.action) {
				case "state":
					restoreState(msg.content);
					break;
				case "move":
					if (turn !== myPlayer) {
						applyMove(msg.col);
					}
					break;
				case "restart":
					newGame();
					break;
			}
		}

		function onNetworkUserChanged(msg) {
			if (msg.move === 1) {
				opponentPresent = true;
				if (isHost) {
					presence.sendMessage(presence.getSharedInfo().id, {
						user: presence.getUserInfo(),
						action: "state",
						content: serializeState()
					});
				}
			} else if (msg.move === -1) {
				opponentPresent = false;
			}
			requestDraw();
		}

		var palette = new presencepalette.PresencePalette(document.getElementById("network-button"), undefined);
		palette.addEventListener("shared", function () {
			palette.popDown();
			presence = activity.getPresenceObject(function (error, network) {
				if (error) {
					console.log("Sharing error");
					return;
				}
				network.createSharedActivity(BUNDLE_ID, function (groupId) {
					isHost = true;
					myPlayer = 1;
					opponentPresent = false;
					setMode("net");
					newGame();
				});
				network.onDataReceived(onNetworkDataReceived);
				network.onSharedActivityUserChanged(onNetworkUserChanged);
			});
		});

		// --- Journal ---
		document.getElementById("stop-button").addEventListener("click", function () {
			var data = serializeState();
			data.mode = (mode === "net") ? "two" : mode;
			activity.getDatastoreObject().setDataAsText(JSON.stringify(data));
			activity.getDatastoreObject().save(function () {});
		});

		// --- Start ---
		newGame();
		updateToolbar();
		resize();

		env.getEnvironment(function (err, environment) {
			var defaultLanguage = (typeof chrome != "undefined" && chrome.app && chrome.app.runtime) ? chrome.i18n.getUILanguage() : navigator.language;
			var language = environment.user ? environment.user.language : defaultLanguage;
			l10n.init(language);

			// Shared instance: we are the guest, the host sends us the state
			if (environment.sharedId) {
				isHost = false;
				myPlayer = 2;
				opponentPresent = true;
				setMode("net");
				presence = activity.getPresenceObject(function (error, network) {
					network.onDataReceived(onNetworkDataReceived);
					network.onSharedActivityUserChanged(onNetworkUserChanged);
				});
			}

			// Load from the Journal
			if (environment.objectId) {
				activity.getDatastoreObject().loadAsText(function (error, metadata, data) {
					if (error == null && data != null) {
						data = JSON.parse(data);
						setMode(data.mode === "two" ? "two" : "ai");
						restoreState(data);
						scheduleAI();
					}
				});
			}
		});
	});

});
