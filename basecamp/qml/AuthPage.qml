import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    property bool creating: false
    signal loginRequested(string name, string password, bool remember)
    signal createRequested(string name, string password, bool remember)
    signal switchMode

    ColumnLayout {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 28
        spacing: 10

        Text {
            text: creating ? "Create account" : "Log in"
            font.pixelSize: 20
            font.bold: true
        }
        Text {
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            text: creating
                  ? "The key is derived in this app with scrypt. The same name and password work on the web wiki."
                  : "Use the same name and password as the web wiki. Deriving the key can take a few seconds."
            color: "#54595d"
        }
        TextField {
            id: name
            Layout.fillWidth: true
            Layout.fillHeight: false
            implicitHeight: 36
            placeholderText: "User name"
            selectByMouse: true
        }
        TextField {
            id: password
            Layout.fillWidth: true
            Layout.fillHeight: false
            implicitHeight: 36
            placeholderText: "Password"
            echoMode: TextInput.Password
            selectByMouse: true
        }
        CheckBox {
            id: remember
            text: "Remember on this device"
        }
        RowLayout {
            Button {
                text: creating ? "Create account" : "Log in"
                onClicked: {
                    if (creating) createRequested(name.text, password.text, remember.checked)
                    else loginRequested(name.text, password.text, remember.checked)
                }
            }
            Button {
                text: creating ? "Have an account?" : "Create account"
                onClicked: switchMode()
            }
        }
    }
}
