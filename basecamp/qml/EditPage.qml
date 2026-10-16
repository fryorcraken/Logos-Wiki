import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: root
    property string pageTitle: ""
    property string source: ""
    property var previewFn
    signal cancelled
    signal published(string text, string summary)

    property bool previewing: false
    property string previewHtml: ""

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 8

        TextArea {
            id: editor
            Layout.fillWidth: true
            Layout.fillHeight: true
            wrapMode: TextArea.Wrap
            selectByMouse: true
            text: root.source
            visible: !root.previewing
            font.family: "monospace"
            font.pixelSize: 13
        }

        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.previewing
            clip: true
            contentHeight: preview.implicitHeight
            Text {
                id: preview
                width: parent.width
                wrapMode: Text.Wrap
                textFormat: Text.RichText
                font.pixelSize: 16
                text: root.previewHtml
            }
        }

        TextField {
            id: summary
            Layout.fillWidth: true
            placeholderText: "Edit summary"
            selectByMouse: true
        }

        RowLayout {
            WikiButton {
                text: root.previewing ? "Edit" : "Preview"
                onClicked: {
                    if (!root.previewing && root.previewFn) root.previewHtml = root.previewFn(editor.text)
                    root.previewing = !root.previewing
                }
            }
            Item { Layout.fillWidth: true }
            WikiButton { text: "Cancel"; onClicked: root.cancelled() }
            WikiButton { primary: true; text: "Publish"; onClicked: root.published(editor.text, summary.text) }
        }
    }
}
