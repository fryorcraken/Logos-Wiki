import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: root
    property string pageTitle: ""
    property string source: ""
    property string summarySeed: ""
    property bool creating: false
    property bool sectionNew: false
    property bool readOnly: false
    property var previewFn
    property var diffFn
    signal cancelled
    signal published(string text, string summary, bool minor)
    signal openUrl(string url)

    property string panelKind: ""
    property string panelHtml: ""
    property string error: ""
    property bool busy: false

    onSourceChanged: if (editor) editor.text = source

    function showPanel(kind) {
        if (root.readOnly || !kind) return
        root.busy = true
        root.error = ""
        if (kind === "preview" && root.previewFn) root.panelHtml = root.previewFn(editor.text)
        else if (kind === "diff" && root.diffFn) root.panelHtml = root.diffFn(editor.text, summary.text)
        else root.panelHtml = ""
        root.panelKind = kind
        root.busy = false
    }

    function save() {
        if (root.readOnly) return
        root.published(editor.text, summary.text, minor.checked)
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 8

        Text {
            visible: root.error.length
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            color: "#8b0000"
            font.pixelSize: 14
            text: root.error
        }

        Flickable {
            visible: root.panelKind !== ""
            Layout.fillWidth: true
            Layout.preferredHeight: visible ? Math.min(280, parent.height * 0.4) : 0
            clip: true
            contentWidth: width
            contentHeight: panelBody.implicitHeight
            ScrollBar.vertical: ScrollBar {}
            Column {
                id: panelBody
                width: parent.width
                spacing: 6
                Text {
                    visible: root.panelKind === "preview"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 16
                    font.bold: true
                    text: "Preview"
                }
                Text {
                    visible: root.panelKind === "preview"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 13
                    color: "#54595d"
                    text: "Remember that this is only a preview. Your changes have not yet been saved!"
                }
                Text {
                    visible: root.panelKind === "diff"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 14
                    font.bold: true
                    text: "Latest revision → Your text"
                }
                Text {
                    width: parent.width
                    wrapMode: Text.Wrap
                    textFormat: Text.RichText
                    font.pixelSize: 14
                    text: root.panelHtml
                }
            }
        }

        TextArea {
            id: editor
            Layout.fillWidth: true
            Layout.fillHeight: true
            wrapMode: TextArea.Wrap
            selectByMouse: true
            readOnly: root.readOnly
            font.family: "monospace"
            font.pixelSize: 13
            Component.onCompleted: text = root.source
        }

        Text {
            visible: !root.readOnly
            text: root.sectionNew ? "Subject:" : "Summary:"
            font.pixelSize: 14
            font.weight: Font.DemiBold
            color: "#202122"
        }
        TextField {
            id: summary
            visible: !root.readOnly
            Layout.fillWidth: true
            Layout.preferredHeight: visible ? 36 : 0
            placeholderText: root.sectionNew ? "Section subject" : "Enter a short summary"
            selectByMouse: true
            text: root.summarySeed
        }

        CheckBox {
            id: minor
            visible: !root.readOnly
            text: "This is a minor edit"
        }

        RowLayout {
            spacing: 8
            WikiButton {
                visible: !root.readOnly
                primary: true
                enabled: !root.busy
                text: root.creating ? "Save page" : "Save changes"
                onClicked: root.save()
            }
            WikiButton {
                visible: !root.readOnly
                enabled: !root.busy
                text: "Show preview"
                onClicked: root.showPanel("preview")
            }
            WikiButton {
                visible: !root.readOnly
                enabled: !root.busy
                text: "Show changes"
                onClicked: root.showPanel("diff")
            }
            WikiButton {
                text: "Cancel"
                onClicked: root.cancelled()
            }
            Text {
                textFormat: Text.RichText
                font.pixelSize: 13
                text: '<a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Editing_pages">Editing help</a>'
                onLinkActivated: function (link) { root.openUrl(link) }
            }
        }
    }
}
