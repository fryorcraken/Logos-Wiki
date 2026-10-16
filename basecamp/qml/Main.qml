import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtQuick.LocalStorage 2.15
import "wiki.js" as Wiki
import "snapshot.js" as Snap

Item {
    id: root

    property string adminKey: ""
    property string snapshotCid: ""
    property string currentTitle: Wiki.MAIN_PAGE
    property string mode: "article"
    property string notice: ""
    property string busyText: ""
    property string deliveryStatus: "off"
    property string storageStatus: "off"
    property string userName: ""
    property string userKey: ""
    property string seedHex: ""
    property var envelopes: []
    property var article: ({ html: "", title: Wiki.MAIN_PAGE, missing: true, categories: [], headings: [] })
    property var dlChunks: ({})
    property bool menuOpen: false
    property int pageCount: 0
    readonly property bool hasLogos: typeof logos !== "undefined" && logos && logos.callModuleAsync
    readonly property string shippedAdmin: "ee7a5fc7ab70a820df10a4d3ba12f2e3f830c3f486b0d645eded9e8ff729ce08"
    readonly property color ink: "#202122"
    readonly property color muted: "#54595d"
    readonly property color link: "#3366cc"
    readonly property color line: "#a2a9b1"
    readonly property color paper: "#ffffff"
    readonly property color wash: "#f8f9fa"
    readonly property color header: "#eaecf0"
    property var tocItems: []
    property var tabModel: []
    property string editSection: ""
    property string pendingAuth: ""
    property string pendingName: ""
    property string pendingPassword: ""
    property bool pendingRemember: false
    readonly property bool showToc: mode === "article" && tocItems && tocItems.length >= 4
    readonly property bool isAdmin: userKey !== "" && adminKey !== "" && userKey.toLowerCase() === adminKey.toLowerCase()
    readonly property string headingText: {
        if (mode === "login") return "Log in"
        if (mode === "create") return "Create account"
        if (mode === "account") return userName ? userName : "Account"
        if (mode === "edit" || mode === "source") {
            var verb = (article && article.missing) ? "Creating" : (mode === "source" ? "View source for" : "Editing")
            var suffix = editSection === "new" ? " (new section)" : (editSection ? " (section)" : "")
            return verb + " " + currentTitle + suffix
        }
        if (currentTitle === "Special:RecentChanges") return "Recent changes"
        if (currentTitle === "Special:AllPages") return "All pages"
        if (currentTitle === "Special:SpecialPages") return "Special pages"
        if (currentTitle === "Special:Settings") return "Settings"
        if (currentTitle === "Special:TrustedEditors") return "Trusted editors"
        return currentTitle
    }
    readonly property bool showTabs: tabModel && tabModel.length && mode !== "login" && mode !== "create" && mode !== "account" && mode !== "special" && !/^Special:/i.test(currentTitle)

    function db() {
        return LocalStorage.openDatabaseSync("logos-wiki", "1.0", "Logos Wiki cache", 10 * 1024 * 1024)
    }

    function kvGet(key, fallback) {
        var value = fallback
        try {
            db().transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)")
                var rows = tx.executeSql("SELECT v FROM kv WHERE k = ?", [key])
                if (rows.rows.length) value = rows.rows.item(0).v
            })
        } catch (e) {}
        return value
    }

    function kvSet(key, value) {
        try {
            db().transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)")
                tx.executeSql("INSERT OR REPLACE INTO kv VALUES (?, ?)", [key, value])
            })
        } catch (e) {}
    }

    function resetWiki() {
        Wiki.resetEngine(adminKey)
        for (var i = 0; i < envelopes.length; i++) Wiki.ingestEnvelope(envelopes[i])
        renderCurrent()
    }

    function rememberEnvelope(envelope) {
        if (!Wiki.ingestEnvelope(envelope)) return
        envelopes.push(envelope)
        kvSet("envelopes", JSON.stringify(envelopes))
    }

    function renderCurrent() {
        var hop = Wiki.engineFollowRedirect(currentTitle)
        if (hop.hops && hop.title !== currentTitle) currentTitle = hop.title
        article = Wiki.engineRenderPage(currentTitle, userKey !== "" && Wiki.engineCanEdit(userKey, currentTitle))
        tocItems = article && article.toc === false ? [] : ((article && article.headings) ? article.headings : [])
        var stats = Wiki.engineStats()
        pageCount = stats && stats.pages ? stats.pages : 0
        if (mode === "article" || mode === "missing") mode = article.missing ? "missing" : "article"
        refreshTabs()
        scrollArticleTop()
    }

    function refreshTabs() {
        var exists = !(article && article.missing)
        var can = userKey !== "" && Wiki.engineCanEdit(userKey, currentTitle)
        var tabs = []
        if (exists) tabs.push({ label: "Read", mode: "article" })
        if (can) tabs.push({ label: exists ? "Edit" : "Create", mode: "edit" })
        else if (exists) tabs.push({ label: "View source", mode: "source" })
        if (exists) tabs.push({ label: "View history", mode: "history" })
        tabModel = tabs
    }

    function beginEdit(section) {
        if (!userKey) {
            mode = "login"
            notice = "Log in to edit."
            return
        }
        if (!Wiki.engineCanEdit(userKey, currentTitle)) {
            if (article && !article.missing) mode = "source"
            else notice = "You do not have permission to create this page."
            refreshTabs()
            return
        }
        editSection = section || ""
        mode = "edit"
        refreshTabs()
    }

    function editSource() {
        var full = (article && article.source) ? article.source : (Wiki.engineLatestText(currentTitle) || "")
        if (!editSection) return full
        if (editSection === "new") return ""
        var piece = Wiki.sectionText(full, Number(editSection))
        return piece === null ? full : piece
    }

    function editSummarySeed() {
        if (!editSection || editSection === "new") return ""
        var src = editSource()
        var heading = /^(=+)\s*(.*?)\s*\1/.exec(src)
        return heading ? "/* " + heading[2] + " */ " : ""
    }

    function openTitle(title) {
        if (!title) return
        var parsed = Wiki.parseTitle(title)
        if (parsed) title = parsed.full
        if (/^Special:UserLogin$/i.test(title)) {
            currentTitle = title
            mode = userName ? "account" : "login"
            return
        }
        if (/^Special:CreateAccount$/i.test(title)) {
            currentTitle = title
            mode = userName ? "account" : "create"
            return
        }
        if (/^Special:UserLogout$/i.test(title)) {
            currentTitle = title
            mode = "account"
            return
        }
        if (title === "Special:Random") {
            var titles = Wiki.engineTitles()
            if (!titles.length) {
                notice = "No pages yet."
                return
            }
            openTitle(titles[Math.floor(Math.random() * titles.length)])
            return
        }
        if (/^Special:/i.test(title)) {
            currentTitle = title
            mode = "special"
            return
        }
        currentTitle = title
        mode = "article"
        renderCurrent()
    }

    function goMenu(title) {
        menuOpen = false
        openTitle(title)
    }

    function scrollArticleTop() {
        if (pageLoader.item) pageLoader.item.contentY = 0
    }

    function categoryLine() {
        var cats = article && article.categories ? article.categories : []
        if (!cats.length) return ""
        var parts = []
        for (var i = 0; i < cats.length; i++) {
            var name = cats[i].name || cats[i]
            parts.push('<a href="wiki://' + encodeURIComponent("Category:" + name) + '">' + name + "</a>")
        }
        return "<p>Categories: " + parts.join(" · ") + "</p>"
    }

    function openLink(link) {
        if (!link) return
        if (link.indexOf("http://") === 0 || link.indexOf("https://") === 0) {
            notice = "Open in a browser: " + link
            return
        }
        var href = Wiki.parseWikiHref(link)
        if (!href || !href.title) return
        openTitle(href.title)
        if (href.action === "edit") beginEdit(href.section || "")
    }

    function parseResult(payload) {
        if (payload === null || payload === undefined) return { success: false, error: "empty result" }
        if (typeof payload === "boolean" || typeof payload === "number") return { success: true, value: payload }
        if (typeof payload === "object") {
            if (payload.success === undefined && payload.error === undefined) return { success: true, value: payload }
            return payload
        }
        try {
            var parsed = JSON.parse(payload)
            if (parsed && typeof parsed === "object") {
                if (parsed.success === undefined && parsed.error === undefined) return { success: true, value: parsed }
                return parsed
            }
            return { success: true, value: parsed }
        } catch (e) {
            return { success: true, value: payload }
        }
    }

    function isOk(result) {
        if (!result) return false
        if (result.success === false) return false
        if (result.value === false) return false
        return true
    }

    function callMod(mod, method, args, cb) {
        if (!hasLogos) {
            cb({ success: false, error: "Logos bridge is not available" })
            return
        }
        logos.callModuleAsync(mod, method, args, function (payload) { cb(parseResult(payload)) })
    }

    function eventPayload(data) {
        if (!data || data.length === undefined) return data
        var first = data[0]
        if (typeof first === "string" && (first.charAt(0) === "{" || first.charAt(0) === "[")) {
            try { return JSON.parse(first) } catch (e) {}
        }
        if (first && typeof first === "object") return first
        return data
    }

    function onLogosEvent(moduleName, eventName, data) {
        if (moduleName === "delivery_module" && eventName === "connectionStateChanged") {
            deliveryStatus = String((eventPayload(data) && eventPayload(data).status) || data[0] || deliveryStatus)
            return
        }
        if (moduleName === "delivery_module" && eventName === "messageReceived") {
            var topic = data[1]
            if (topic && topic !== Wiki.TOPIC) return
            var text = Wiki.decodeMessage(data[2])
            if (!text) return
            var message
            try { message = JSON.parse(text) } catch (e) { return }
            if (message && typeof message.snapshot === "string") downloadSnapshot(message.snapshot)
            else rememberEnvelope(message)
            renderCurrent()
            return
        }
        if (moduleName !== "storage_module") return
        var payload = eventPayload(data)
        if (eventName === "storageDownloadProgress" && payload && payload.chunk && payload.sessionId) {
            if (!dlChunks[payload.sessionId]) dlChunks[payload.sessionId] = []
            dlChunks[payload.sessionId].push(payload.chunk)
            busyText = "Downloading snapshot…"
        }
        if (eventName === "storageDownloadDone" && payload && payload.sessionId) {
            var chunks = dlChunks[payload.sessionId] || []
            delete dlChunks[payload.sessionId]
            busyText = ""
            if (!payload.success) {
                notice = payload.error || "Snapshot download failed"
                return
            }
            ingestSnapshot(Wiki.joinBase64Chunks(chunks))
        }
    }

    function loadBundledSnapshot(quiet) {
        try {
            var list = Snap.EVENTS
            if (!list || !list.length) {
                notice = "Bundled snapshot is empty"
                return 0
            }
            Wiki.ingestSnapshotEvents(list)
            renderCurrent()
            var pages = Wiki.engineStats().pages
            if (!pages) notice = "Bundled snapshot loaded 0 pages"
            else if (!quiet) notice = pages + " pages loaded"
            return pages
        } catch (e) {
            notice = "Snapshot load failed: " + e
            return 0
        }
    }

    function ingestSnapshot(text, quiet) {
        if (!text) return 0
        var lines = text.split("\n")
        var added = 0
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i]) continue
            try {
                var envelope = JSON.parse(lines[i])
                if (!Wiki.ingestEnvelope(envelope)) continue
                envelopes.push(envelope)
                added++
            } catch (e) {}
        }
        if (added) kvSet("envelopes", JSON.stringify(envelopes))
        renderCurrent()
        if (!quiet && added) notice = "Loaded " + added + " events"
        return added
    }

    function downloadSnapshot(cid) {
        if (!cid || storageStatus !== "online") return
        busyText = "Fetching snapshot…"
        callMod("storage_module", "downloadChunks", [cid, false, 65536], function (result) {
            if (!result.success) {
                busyText = ""
                notice = result.error || "downloadChunks failed"
            }
        })
    }

    function startStorage() {
        callMod("storage_module", "isRunning", [], function (running) {
            if (isOk(running) && (running.value === true || running.value === "true" || running.success === true)) {
                storageStatus = "online"
                if (snapshotCid) downloadSnapshot(snapshotCid)
                return
            }
            callMod("storage_module", "loadConfigOrDefault", [], function (cfg) {
                var conf = cfg.value !== undefined ? cfg.value : ""
                callMod("storage_module", "init", [typeof conf === "string" ? conf : JSON.stringify(conf)], function () {
                    callMod("storage_module", "start", [], function (started) {
                        storageStatus = isOk(started) ? "online" : "error"
                        if (!isOk(started)) notice = started.error || "storage_module did not start"
                        else if (snapshotCid) downloadSnapshot(snapshotCid)
                    })
                })
            })
        })
    }

    function subscribeTopic() {
        callMod("delivery_module", "subscribe", [Wiki.TOPIC], function (result) {
            deliveryStatus = isOk(result) ? "online" : "error"
            if (!isOk(result)) notice = result.error || "subscribe failed"
        })
    }

    function startDelivery() {
        callMod("delivery_module", "getConnectionStatus", [], function (status) {
            if (status.success && status.value && status.value !== "Disconnected") {
                subscribeTopic()
                return
            }
            callMod("delivery_module", "createNode", [JSON.stringify({ mode: "Edge", preset: Wiki.PRESET })], function (created) {
                if (!created.success && created.error && String(created.error).indexOf("already") < 0) {
                    notice = created.error
                    deliveryStatus = "error"
                    return
                }
                callMod("delivery_module", "start", [], function () { subscribeTopic() })
            })
        })
    }

    function sendEnvelope(envelope, okText) {
        var payload = JSON.stringify(envelope)
        rememberEnvelope(envelope)
        renderCurrent()
        if (!hasLogos) {
            notice = (okText || "Saved locally") + " (Delivery is offline)"
            return
        }
        callMod("delivery_module", "send", [Wiki.TOPIC, payload], function (result) {
            notice = isOk(result) ? (okText || "Published") : (result.error || "send failed")
        })
    }

    function applySession(seedHexNext, key, name, remember, created) {
        seedHex = seedHexNext
        userKey = key
        userName = Wiki.engineAccountName(key)
        if (remember) kvSet("session", JSON.stringify({ seedHex: seedHex, name: name }))
        else kvSet("session", "")
        if (created) userName = userName || name
        else if (userName !== name) {
            notice = "Incorrect username or password entered. Please try again."
            userName = ""
            userKey = ""
            seedHex = ""
            return
        }
        notice = created ? "Account created" : ("Signed in as " + userName)
        if (/^Special:(UserLogin|CreateAccount|UserLogout)$/i.test(currentTitle)) currentTitle = Wiki.MAIN_PAGE
        mode = "article"
        renderCurrent()
    }

    function login(name, password, remember) {
        pendingAuth = "login"
        pendingName = Wiki.normalizeUsername(name)
        pendingPassword = password
        pendingRemember = remember
        busyText = "Please wait…"
        authTimer.restart()
    }

    function createAccount(name, password, remember) {
        var normalized = Wiki.normalizeUsername(name)
        var valid = Wiki.validUsername(normalized)
        if (!valid) {
            notice = "The username is invalid."
            return
        }
        if (!password || password.length < 10) {
            notice = "Passwords must be at least 10 characters."
            return
        }
        pendingAuth = "create"
        pendingName = valid
        pendingPassword = password
        pendingRemember = !!remember
        busyText = "Please wait…"
        authTimer.restart()
    }

    function finishAuth() {
        try {
            var auth = Wiki.engineAuth(pendingName, pendingPassword)
            if (pendingAuth === "create") {
                if (Wiki.engineAccountTaken(auth.key, pendingName)) {
                    notice = "Username entered already in use. Please choose a different name."
                    busyText = ""
                    return
                }
                sendEnvelope(Wiki.publishBody(auth.seedHex, { t: "account", name: pendingName }), "Account created")
                applySession(auth.seedHex, auth.key, pendingName, pendingRemember, true)
            } else applySession(auth.seedHex, auth.key, pendingName, pendingRemember, false)
        } catch (err) {
            notice = String(err)
        }
        busyText = ""
        pendingAuth = ""
        pendingPassword = ""
    }

    function logout() {
        userName = ""
        userKey = ""
        seedHex = ""
        kvSet("session", "")
        notice = "You are now logged out."
        mode = "account"
        refreshTabs()
    }

    function saveSettings(nextAdmin, nextSnapshot) {
        adminKey = (nextAdmin || Wiki.ADMIN_KEY || shippedAdmin).toLowerCase()
        snapshotCid = nextSnapshot || Wiki.SNAPSHOT_CID || ""
        kvSet("adminKey", adminKey)
        kvSet("snapshotCid", snapshotCid)
        resetWiki()
        loadBundledSnapshot(true)
        if (snapshotCid && storageStatus === "online") downloadSnapshot(snapshotCid)
        notice = "Settings saved"
        mode = "article"
    }

    function publishEdit(title, text, summary, minor) {
        if (!seedHex) {
            mode = "login"
            notice = "Log in to edit."
            return
        }
        var parsed = Wiki.parseTitle(title)
        if (!parsed || parsed.ns < 0) {
            notice = "The page title is invalid."
            return
        }
        title = parsed.full
        if (!Wiki.engineCanEdit(userKey, title)) {
            notice = "You do not have permission to edit this page."
            return
        }
        var original = Wiki.engineLatestText(title) || ""
        var full = text
        var summaryText = summary || ""
        if (editSection === "new") {
            var heading = String(summary || "").trim()
            full = Wiki.appendSection(original, heading, text)
            summaryText = heading ? ("/* " + heading + " */ new section") : summaryText
        } else if (editSection) full = Wiki.replaceSection(original, Number(editSection), text)
        if (full === null) {
            notice = "The section you are editing could not be found."
            return
        }
        var body = { t: "edit", title: title, text: full, summary: summaryText }
        if (minor) body.minor = true
        var created = !Wiki.enginePageExists(title)
        sendEnvelope(Wiki.publishBody(seedHex, body), created ? "Page created" : "Edit published")
        editSection = ""
        currentTitle = title
        mode = "article"
        renderCurrent()
    }

    function publishTrust(text) {
        if (!seedHex || !Wiki.engineIsAdmin(userKey)) {
            notice = "Only the administrator can change the trusted editors list."
            return
        }
        var lines = String(text || "").split("\n")
        var names = []
        for (var i = 0; i < lines.length; i++) {
            var n = Wiki.validUsername(Wiki.normalizeUsername(lines[i]))
            if (n && names.indexOf(n) < 0) names.push(n)
        }
        sendEnvelope(Wiki.publishBody(seedHex, { t: "trust", editors: names }), "Trusted editors saved")
        renderCurrent()
    }

    function boot() {
        adminKey = (kvGet("adminKey", "") || Wiki.ADMIN_KEY || shippedAdmin).toLowerCase()
        snapshotCid = kvGet("snapshotCid", "") || Wiki.SNAPSHOT_CID || ""
        try { envelopes = JSON.parse(kvGet("envelopes", "[]")) } catch (e) { envelopes = [] }
        if (!(envelopes instanceof Array)) envelopes = []
        try {
            var session = JSON.parse(kvGet("session", "null"))
            if (session && session.seedHex) {
                seedHex = session.seedHex
                userKey = Wiki.publicKey(Wiki.hexToBytes(seedHex))
            }
        } catch (e) {}
        resetWiki()
        loadBundledSnapshot(true)
        if (userKey) userName = Wiki.engineAccountName(userKey)
        if (!hasLogos) {
            notice = notice || "Running without the Logos bridge. Pages come from the local cache only."
            return
        }
        logos.onModuleEvent("delivery_module", "messageReceived")
        logos.onModuleEvent("delivery_module", "connectionStateChanged")
        logos.onModuleEvent("storage_module", "storageDownloadProgress")
        logos.onModuleEvent("storage_module", "storageDownloadDone")
        startStorage()
        startDelivery()
    }

    Connections {
        target: root.hasLogos ? logos : null
        function onModuleEventReceived(moduleName, eventName, data) {
            root.onLogosEvent(moduleName, eventName, data)
        }
        function onIntentRequested(requestId, intent, params, requesterName) {
            if (intent === "wiki.open") {
                if (params && params.title) root.openTitle(params.title)
                logos.respond(requestId, true, {}, "")
            }
        }
    }

    Timer {
        id: authTimer
        interval: 40
        repeat: false
        onTriggered: root.finishAuth()
    }

    Component.onCompleted: boot()

    Rectangle {
        anchors.fill: parent
        color: root.paper
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: root.header

            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: root.line
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 8
                anchors.rightMargin: 12
                spacing: 8

                Item {
                    Layout.preferredWidth: 40
                    Layout.preferredHeight: 40
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.menuOpen = !root.menuOpen
                    }
                    Column {
                        anchors.centerIn: parent
                        spacing: 4
                        Repeater {
                            model: 3
                            Rectangle {
                                width: 18
                                height: 2
                                radius: 1
                                color: root.ink
                            }
                        }
                    }
                }

                Image {
                    source: "logo.png"
                    Layout.preferredWidth: 36
                    Layout.preferredHeight: 36
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    mipmap: true
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.openTitle(Wiki.MAIN_PAGE)
                    }
                }

                Text {
                    text: Wiki.SITENAME
                    color: root.ink
                    font.pixelSize: 18
                    font.weight: Font.DemiBold
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.openTitle(Wiki.MAIN_PAGE)
                    }
                }

                Item { Layout.fillWidth: true }

                TextField {
                    id: searchField
                    Layout.preferredWidth: 240
                    Layout.preferredHeight: 32
                    placeholderText: "Search"
                    selectByMouse: true
                    leftPadding: 8
                    rightPadding: 8
                    color: root.ink
                    font.pixelSize: 13
                    onAccepted: if (text) root.openTitle(text)
                    background: Rectangle {
                        radius: 2
                        color: root.paper
                        border.width: 1
                        border.color: searchField.activeFocus ? root.link : root.line
                    }
                }
                WikiButton {
                    text: "Search"
                    onClicked: if (searchField.text) root.openTitle(searchField.text)
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: notice.length || busyText.length ? 28 : 0
            color: "#fef6e7"
            visible: height > 0
            Text {
                anchors.verticalCenter: parent.verticalCenter
                anchors.left: parent.left
                anchors.leftMargin: 16
                text: root.busyText || root.notice
                color: root.ink
                font.pixelSize: 12
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: root.paper

            RowLayout {
                anchors.fill: parent
                spacing: 0

                Rectangle {
                    visible: root.showToc
                    Layout.preferredWidth: visible ? 232 : 0
                    Layout.fillHeight: true
                    color: root.paper
                    Rectangle {
                        anchors.right: parent.right
                        width: 1
                        height: parent.height
                        color: root.line
                    }
                    Flickable {
                        anchors.fill: parent
                        anchors.leftMargin: 16
                        anchors.rightMargin: 12
                        anchors.topMargin: 16
                        anchors.bottomMargin: 12
                        clip: true
                        contentHeight: tocCol.implicitHeight
                        Column {
                            id: tocCol
                            width: parent.width
                            spacing: 8
                            Text {
                                text: "Contents"
                                font.pixelSize: 14
                                font.weight: Font.DemiBold
                                color: root.ink
                            }
                            Rectangle { width: tocCol.width; height: 1; color: root.line }
                            Text {
                                text: "Beginning"
                                font.pixelSize: 14
                                color: root.link
                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: root.scrollArticleTop()
                                }
                            }
                            Repeater {
                                model: root.tocItems
                                Text {
                                    width: tocCol.width
                                    wrapMode: Text.Wrap
                                    leftPadding: Math.max(0, ((modelData.toclevel || 1) - 1) * 12)
                                    text: (modelData.number ? modelData.number + "  " : "") + (modelData.text || "")
                                    font.pixelSize: 14
                                    color: root.link
                                }
                            }
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 0

                    Column {
                        Layout.fillWidth: true
                        Layout.leftMargin: 20
                        Layout.rightMargin: 20
                        Layout.topMargin: 10
                        Layout.bottomMargin: 4
                        spacing: 2
                        Text {
                            width: parent.width
                            text: root.headingText
                            color: root.ink
                            font.pixelSize: 32
                            font.bold: true
                            wrapMode: Text.Wrap
                        }
                        Text {
                            visible: (root.mode === "article" || root.mode === "missing") && root.currentTitle !== Wiki.MAIN_PAGE
                            text: "From " + Wiki.SITENAME
                            color: root.muted
                            font.pixelSize: 13
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: root.showTabs ? 40 : 0
                        color: root.paper
                        visible: root.showTabs
                        Row {
                            anchors.left: parent.left
                            anchors.leftMargin: 8
                            anchors.bottom: parent.bottom
                            height: 40
                            Repeater {
                                model: root.tabModel
                                Item {
                                    width: tabLabel.implicitWidth + 24
                                    height: 40
                                    Text {
                                        id: tabLabel
                                        anchors.centerIn: parent
                                        text: modelData.label
                                        font.pixelSize: 15
                                        font.weight: root.mode === modelData.mode ? Font.DemiBold : Font.Normal
                                        color: root.mode === modelData.mode ? root.ink : root.muted
                                    }
                                    Rectangle {
                                        anchors.bottom: parent.bottom
                                        width: parent.width
                                        height: 3
                                        color: root.mode === modelData.mode ? root.link : "transparent"
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: {
                                            if (modelData.mode === "article") {
                                                root.editSection = ""
                                                root.mode = "article"
                                                root.renderCurrent()
                                                return
                                            }
                                            if (modelData.mode === "history") {
                                                root.mode = "history"
                                                return
                                            }
                                            if (modelData.mode === "source") {
                                                root.editSection = ""
                                                root.mode = "source"
                                                return
                                            }
                                            root.beginEdit("")
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: root.line }

                    Loader {
                        id: pageLoader
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        sourceComponent: {
                            if (root.mode === "edit" || root.mode === "source") return editPage
                            if (root.mode === "history") return historyPage
                            if (root.mode === "login" || root.mode === "create") return authPage
                            if (root.mode === "account") return accountPage
                            if (root.mode === "special" || /^Special:/i.test(root.currentTitle)) return specialPage
                            return articlePage
                        }
                    }
                }
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        color: "#99000000"
        visible: root.menuOpen
        z: 20
        MouseArea {
            anchors.fill: parent
            onClicked: root.menuOpen = false
        }
    }

    Rectangle {
        id: drawer
        width: 280
        height: parent.height
        x: root.menuOpen ? 0 : -width
        z: 21
        color: root.paper
        Behavior on x { NumberAnimation { duration: 140; easing.type: Easing.OutCubic } }

        Rectangle {
            anchors.right: parent.right
            width: 1
            height: parent.height
            color: root.line
        }

        Column {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 4

            Row {
                spacing: 10
                height: 40
                Image {
                    source: "logo.png"
                    width: 36
                    height: 36
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    anchors.verticalCenter: parent.verticalCenter
                }
                Column {
                    anchors.verticalCenter: parent.verticalCenter
                    Text { text: Wiki.SITENAME; font.pixelSize: 16; font.weight: Font.DemiBold; color: root.ink }
                    Text { text: "Logos Wiki"; font.pixelSize: 11; color: root.muted }
                }
            }

            Item { height: 12 }

            Repeater {
                model: [
                    { label: "Main Page", title: Wiki.MAIN_PAGE },
                    { label: "Recent changes", title: "Special:RecentChanges" },
                    { label: "All pages", title: "Special:AllPages" },
                    { label: "Random page", title: "Special:Random" },
                    { label: "Special pages", title: "Special:SpecialPages" },
                    { label: "Settings", title: "Special:Settings" }
                ]
                Rectangle {
                    width: drawer.width - 32
                    height: 36
                    radius: 2
                    color: itemArea.containsMouse ? root.wash : "transparent"
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.left: parent.left
                        anchors.leftMargin: 8
                        text: modelData.label
                        color: root.link
                        font.pixelSize: 14
                    }
                    MouseArea {
                        id: itemArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.goMenu(modelData.title)
                    }
                }
            }

            Item { height: 12 }
            WikiButton {
                width: drawer.width - 32
                primary: !root.userName
                text: root.userName ? root.userName : "Log in"
                onClicked: {
                    root.menuOpen = false
                    root.mode = root.userName ? "account" : "login"
                }
            }
            Item { height: 12 }
            Text { text: root.pageCount + " pages"; color: root.muted; font.pixelSize: 11 }
        }
    }

    Component {
        id: articlePage
        Flickable {
            id: articleFlick
            clip: true
            contentWidth: width
            contentHeight: bodyCol.implicitHeight + 32
            ScrollBar.vertical: ScrollBar {}
            Column {
                id: bodyCol
                width: parent.width - 40
                x: 20
                y: 12
                spacing: 16
                Column {
                    visible: root.article && root.article.missing
                    width: parent.width
                    spacing: 10
                    Text {
                        width: parent.width
                        wrapMode: Text.Wrap
                        font.pixelSize: 16
                        color: root.ink
                        text: "There is currently no text in this page."
                    }
                    Text {
                        width: parent.width
                        wrapMode: Text.Wrap
                        font.pixelSize: 16
                        color: root.ink
                        text: root.userKey && Wiki.engineCanEdit(root.userKey, root.currentTitle)
                              ? "You can search for this page title in other pages, or create this page."
                              : "You can search for this page title in other pages, but you do not have permission to create this page."
                    }
                    WikiButton {
                        visible: root.userKey && Wiki.engineCanEdit(root.userKey, root.currentTitle)
                        primary: true
                        text: "Create this page"
                        onClicked: root.beginEdit("")
                    }
                }
                Text {
                    visible: !(root.article && root.article.missing)
                    width: parent.width
                    wrapMode: Text.Wrap
                    textFormat: Text.RichText
                    color: root.ink
                    font.pixelSize: 16
                    lineHeight: 1.35
                    lineHeightMode: Text.ProportionalHeight
                    text: root.article && root.article.html ? root.article.html : ""
                    onLinkActivated: function (link) { root.openLink(link) }
                }
                Rectangle {
                    visible: root.article && root.article.categories && root.article.categories.length
                    width: parent.width
                    height: cats.implicitHeight + 16
                    color: root.wash
                    border.color: root.line
                    border.width: 1
                    Text {
                        id: cats
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.margins: 8
                        wrapMode: Text.Wrap
                        textFormat: Text.RichText
                        font.pixelSize: 14
                        color: root.ink
                        text: root.categoryLine()
                        onLinkActivated: function (link) { root.openLink(link) }
                    }
                }
            }
        }
    }

    Component {
        id: editPage
        EditPage {
            pageTitle: root.currentTitle
            source: root.editSource()
            summarySeed: root.editSummarySeed()
            creating: !!(root.article && root.article.missing)
            sectionNew: root.editSection === "new"
            readOnly: root.mode === "source"
            previewFn: function (text) {
                return Wiki.enginePreview(root.currentTitle, text)
            }
            diffFn: function (text, summary) {
                var original = Wiki.engineLatestText(root.currentTitle) || ""
                var full = text
                if (root.editSection === "new") full = Wiki.appendSection(original, summary, text)
                else if (root.editSection) full = Wiki.replaceSection(original, Number(root.editSection), text)
                if (full === null) full = text
                return Wiki.engineDiff(original, full)
            }
            onCancelled: { root.editSection = ""; root.mode = "article"; root.renderCurrent() }
            onPublished: function (text, summary, minor) { root.publishEdit(root.currentTitle, text, summary, minor) }
            onOpenUrl: function (url) { root.openLink(url) }
        }
    }

    Component {
        id: historyPage
        HistoryPage {
            revisions: Wiki.engineRevisions(root.currentTitle)
        }
    }

    Component {
        id: authPage
        AuthPage {
            creating: root.mode === "create"
            busy: root.busyText === "Please wait…"
            sitename: Wiki.SITENAME
            onLoginRequested: function (name, password, remember) { root.login(name, password, remember) }
            onCreateRequested: function (name, password, remember) { root.createAccount(name, password, remember) }
            onSwitchMode: root.mode = root.mode === "create" ? "login" : "create"
            onOpenUrl: function (url) { root.openLink(url) }
        }
    }

    Component {
        id: accountPage
        Flickable {
            clip: true
            contentHeight: col.implicitHeight + 32
            Column {
                id: col
                x: 20
                y: 12
                width: parent.width - 40
                spacing: 12
                Text {
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 16
                    color: root.ink
                    text: root.userName ? "Do you want to log out?" : "You are now logged out."
                }
                WikiButton {
                    visible: root.userName !== ""
                    text: "Log out"
                    onClicked: root.logout()
                }
            }
        }
    }

    Component {
        id: specialPage
        SpecialPage {
            title: root.currentTitle
            adminKey: root.adminKey
            snapshotCid: root.snapshotCid
            isAdmin: root.isAdmin
            onOpenTitle: function (name) { root.openTitle(name) }
            onSaveSettings: function (nextAdmin, nextSnapshot) { root.saveSettings(nextAdmin, nextSnapshot) }
            onSaveTrusted: function (editors) { root.publishTrust(editors) }
        }
    }
}
