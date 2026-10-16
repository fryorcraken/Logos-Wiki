import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: root
    property bool creating: false
    property bool busy: false
    property string sitename: "wiki"
    signal loginRequested(string name, string password, bool remember)
    signal createRequested(string name, string password, bool remember)
    signal switchMode
    signal openUrl(string url)

    function submit() {
        if (root.busy) return
        if (creating) {
            if (password.text !== retype.text) {
                errorText.text = "The passwords you entered do not match."
                return
            }
            if (password.text.length < 10) {
                errorText.text = "Passwords must be at least 10 characters."
                return
            }
            errorText.text = ""
            createRequested(name.text, password.text, false)
            return
        }
        errorText.text = ""
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
                id: errorText
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: "#8b0000"
                font.pixelSize: 14
                visible: text.length
            }

            Text {
                text: "Username"
                color: "#202122"
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            TextField {
                id: name
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                placeholderText: "Enter your username"
                selectByMouse: true
                onAccepted: root.submit()
            }

            Text {
                text: "Password"
                color: "#202122"
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
                onAccepted: root.submit()
            }
            Text {
                visible: root.creating
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: "#54595d"
                font.pixelSize: 13
                text: "Your password is your key: it cannot be reset, so store it safely. Use a unique password of at least 10 characters."
            }

            Text {
                visible: root.creating
                text: "Confirm password"
                color: "#202122"
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            TextField {
                id: retype
                visible: root.creating
                Layout.fillWidth: true
                Layout.preferredHeight: visible ? 36 : 0
                placeholderText: "Enter password again"
                echoMode: TextInput.Password
                selectByMouse: true
                onAccepted: root.submit()
            }

            CheckBox {
                id: remember
                visible: !root.creating
                text: "Keep me logged in"
            }

            WikiButton {
                primary: true
                enabled: !root.busy
                text: root.busy ? "Please wait…" : (creating ? "Create your account" : "Log in")
                onClicked: root.submit()
            }

            Text {
                visible: !root.creating
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                textFormat: Text.RichText
                font.pixelSize: 14
                text: '<a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Logging_in">Help with logging in</a>'
                onLinkActivated: function (link) { root.openUrl(link) }
            }

            RowLayout {
                visible: !root.creating
                spacing: 8
                Text {
                    text: "Don't have an account?"
                    font.pixelSize: 14
                    color: "#202122"
                }
                WikiButton {
                    text: "Join " + root.sitename
                    onClicked: root.switchMode()
                }
            }
        }
    }
}
