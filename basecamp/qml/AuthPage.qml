import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: root
    property bool creating: false
    property bool busy: false
    property bool dark: false
    property string sitename: "wiki"
    property string error: ""
    property string waitText: ""
    property string localError: ""
    signal loginRequested(string name, string password, bool remember)
    signal createRequested(string name, string password, bool remember)
    signal switchMode
    signal openUrl(string url)

    readonly property color ink: dark ? "#eaecf0" : "#202122"
    readonly property color muted: dark ? "#a2a9b1" : "#54595d"
    readonly property color line: dark ? "#54595d" : "#a2a9b1"
    readonly property color paper: dark ? "#101418" : "#ffffff"
    readonly property color link: dark ? "#88a3e8" : "#3366cc"
    readonly property string linkHex: dark ? "#88a3e8" : "#3366cc"
    readonly property color danger: dark ? "#fd7865" : "#8b0000"
    readonly property string shownError: localError || error
    readonly property string statusText: waitText || (creating
        ? "Creating your account… this can take about a minute."
        : "Logging in… this can take about a minute.")

    onErrorChanged: localError = ""

    function submit() {
        if (root.busy) return
        if (creating) {
            if (password.text !== retype.text) {
                localError = "The passwords you entered do not match."
                return
            }
            if (password.text.length < 10) {
                localError = "Passwords must be at least 10 characters."
                return
            }
            localError = ""
            createRequested(name.text, password.text, false)
            return
        }
        localError = ""
        loginRequested(name.text, password.text, remember.checked)
    }

    Flickable {
        anchors.fill: parent
        clip: true
        contentHeight: form.implicitHeight + 40
        ScrollBar.vertical: ScrollBar {}

        ColumnLayout {
            id: form
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.leftMargin: 20
            anchors.rightMargin: 20
            anchors.topMargin: 12
            spacing: 10

            Text {
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: root.danger
                font.pixelSize: 14
                visible: root.shownError.length && !root.busy
                text: root.shownError
            }

            Text {
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: root.muted
                font.pixelSize: 14
                visible: root.busy
                text: root.statusText
            }

            Text {
                text: "Username"
                color: root.ink
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            TextField {
                id: name
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                placeholderText: "Enter your username"
                selectByMouse: true
                enabled: !root.busy
                color: root.ink
                placeholderTextColor: root.muted
                palette.base: root.paper
                palette.text: root.ink
                palette.mid: root.line
                onAccepted: root.submit()
            }

            Text {
                text: "Password"
                color: root.ink
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            TextField {
                id: password
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                placeholderText: creating ? "Enter a password" : "Enter your password"
                echoMode: TextInput.Password
                selectByMouse: true
                enabled: !root.busy
                color: root.ink
                placeholderTextColor: root.muted
                palette.base: root.paper
                palette.text: root.ink
                palette.mid: root.line
                onAccepted: root.submit()
            }
            Text {
                visible: root.creating
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: root.muted
                font.pixelSize: 13
                text: "Your password is your key: it cannot be reset, so store it safely. Use a unique password of at least 10 characters."
            }

            Text {
                visible: root.creating
                text: "Confirm password"
                color: root.ink
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            TextField {
                id: retype
                visible: root.creating
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                placeholderText: "Enter password again"
                echoMode: TextInput.Password
                selectByMouse: true
                enabled: !root.busy
                color: root.ink
                placeholderTextColor: root.muted
                palette.base: root.paper
                palette.text: root.ink
                palette.mid: root.line
                onAccepted: root.submit()
            }

            CheckBox {
                id: remember
                visible: !root.creating
                enabled: !root.busy
                text: "Keep me logged in"
                palette.windowText: root.ink
                palette.text: root.ink
            }

            WikiButton {
                primary: true
                dark: root.dark
                enabled: !root.busy
                text: creating ? "Create your account" : "Log in"
                onClicked: root.submit()
            }

            Text {
                visible: !root.creating
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                textFormat: Text.RichText
                font.pixelSize: 14
                text: '<a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Logging_in"><font color="' + root.linkHex + '">Help with logging in</font></a>'
                onLinkActivated: function (link) { root.openUrl(link) }
            }

            RowLayout {
                visible: !root.creating
                spacing: 8
                Text {
                    text: "Don't have an account?"
                    font.pixelSize: 14
                    color: root.ink
                }
                WikiButton {
                    dark: root.dark
                    text: "Join " + root.sitename
                    onClicked: root.switchMode()
                }
            }
        }
    }
}
