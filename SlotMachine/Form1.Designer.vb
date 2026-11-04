<Global.Microsoft.VisualBasic.CompilerServices.DesignerGenerated()>
Partial Class Form1
    Inherits System.Windows.Forms.Form

    'Form overrides dispose to clean up the component list.
    <System.Diagnostics.DebuggerNonUserCode()>
    Protected Overrides Sub Dispose(ByVal disposing As Boolean)
        Try
            If disposing AndAlso components IsNot Nothing Then
                components.Dispose()
            End If
        Finally
            MyBase.Dispose(disposing)
        End Try
    End Sub

    'Required by the Windows Form Designer
    Private components As System.ComponentModel.IContainer

    'NOTE: The following procedure is required by the Windows Form Designer
    'It can be modified using the Windows Form Designer.
    'Do not modify it using the code editor.
    <System.Diagnostics.DebuggerStepThrough()>
    Private Sub InitializeComponent()
        Me.lblTitle = New System.Windows.Forms.Label()
        Me.lblReel1 = New System.Windows.Forms.Label()
        Me.lblReel2 = New System.Windows.Forms.Label()
        Me.lblReel3 = New System.Windows.Forms.Label()
        Me.lblBalance = New System.Windows.Forms.Label()
        Me.lblBetCaption = New System.Windows.Forms.Label()
        Me.txtBet = New System.Windows.Forms.TextBox()
        Me.btnSpin = New System.Windows.Forms.Button()
        Me.lblResult = New System.Windows.Forms.Label()
        Me.lblHistoryCaption = New System.Windows.Forms.Label()
        Me.lstHistory = New System.Windows.Forms.ListBox()
        Me.SuspendLayout()
        '
        'lblTitle
        '
        Me.lblTitle.Font = New System.Drawing.Font("Segoe UI", 20.0!, System.Drawing.FontStyle.Bold)
        Me.lblTitle.Location = New System.Drawing.Point(20, 10)
        Me.lblTitle.Name = "lblTitle"
        Me.lblTitle.Size = New System.Drawing.Size(430, 45)
        Me.lblTitle.TabIndex = 0
        Me.lblTitle.Text = "VB SLOTS"
        Me.lblTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter
        '
        'lblReel1
        '
        Me.lblReel1.BackColor = System.Drawing.Color.White
        Me.lblReel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.lblReel1.Font = New System.Drawing.Font("Segoe UI", 16.0!, System.Drawing.FontStyle.Bold)
        Me.lblReel1.Location = New System.Drawing.Point(20, 65)
        Me.lblReel1.Name = "lblReel1"
        Me.lblReel1.Size = New System.Drawing.Size(130, 80)
        Me.lblReel1.TabIndex = 1
        Me.lblReel1.Text = "?"
        Me.lblReel1.TextAlign = System.Drawing.ContentAlignment.MiddleCenter
        '
        'lblReel2
        '
        Me.lblReel2.BackColor = System.Drawing.Color.White
        Me.lblReel2.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.lblReel2.Font = New System.Drawing.Font("Segoe UI", 16.0!, System.Drawing.FontStyle.Bold)
        Me.lblReel2.Location = New System.Drawing.Point(170, 65)
        Me.lblReel2.Name = "lblReel2"
        Me.lblReel2.Size = New System.Drawing.Size(130, 80)
        Me.lblReel2.TabIndex = 2
        Me.lblReel2.Text = "?"
        Me.lblReel2.TextAlign = System.Drawing.ContentAlignment.MiddleCenter
        '
        'lblReel3
        '
        Me.lblReel3.BackColor = System.Drawing.Color.White
        Me.lblReel3.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.lblReel3.Font = New System.Drawing.Font("Segoe UI", 16.0!, System.Drawing.FontStyle.Bold)
        Me.lblReel3.Location = New System.Drawing.Point(320, 65)
        Me.lblReel3.Name = "lblReel3"
        Me.lblReel3.Size = New System.Drawing.Size(130, 80)
        Me.lblReel3.TabIndex = 3
        Me.lblReel3.Text = "?"
        Me.lblReel3.TextAlign = System.Drawing.ContentAlignment.MiddleCenter
        '
        'lblBalance
        '
        Me.lblBalance.Font = New System.Drawing.Font("Segoe UI", 12.0!, System.Drawing.FontStyle.Bold)
        Me.lblBalance.Location = New System.Drawing.Point(20, 160)
        Me.lblBalance.Name = "lblBalance"
        Me.lblBalance.Size = New System.Drawing.Size(430, 28)
        Me.lblBalance.TabIndex = 4
        Me.lblBalance.Text = "Balance: $100"
        '
        'lblBetCaption
        '
        Me.lblBetCaption.Font = New System.Drawing.Font("Segoe UI", 11.0!)
        Me.lblBetCaption.Location = New System.Drawing.Point(20, 203)
        Me.lblBetCaption.Name = "lblBetCaption"
        Me.lblBetCaption.Size = New System.Drawing.Size(55, 25)
        Me.lblBetCaption.TabIndex = 5
        Me.lblBetCaption.Text = "Bet: $"
        '
        'txtBet
        '
        Me.txtBet.Font = New System.Drawing.Font("Segoe UI", 11.0!)
        Me.txtBet.Location = New System.Drawing.Point(80, 200)
        Me.txtBet.Name = "txtBet"
        Me.txtBet.Size = New System.Drawing.Size(100, 27)
        Me.txtBet.TabIndex = 6
        Me.txtBet.Text = "10"
        '
        'btnSpin
        '
        Me.btnSpin.Font = New System.Drawing.Font("Segoe UI", 12.0!, System.Drawing.FontStyle.Bold)
        Me.btnSpin.Location = New System.Drawing.Point(200, 195)
        Me.btnSpin.Name = "btnSpin"
        Me.btnSpin.Size = New System.Drawing.Size(130, 38)
        Me.btnSpin.TabIndex = 7
        Me.btnSpin.Text = "SPIN"
        Me.btnSpin.UseVisualStyleBackColor = True
        '
        'lblResult
        '
        Me.lblResult.Font = New System.Drawing.Font("Segoe UI", 10.0!)
        Me.lblResult.Location = New System.Drawing.Point(20, 245)
        Me.lblResult.Name = "lblResult"
        Me.lblResult.Size = New System.Drawing.Size(430, 50)
        Me.lblResult.TabIndex = 8
        Me.lblResult.Text = "Enter a bet and press Spin!"
        '
        'lblHistoryCaption
        '
        Me.lblHistoryCaption.Font = New System.Drawing.Font("Segoe UI", 10.0!, System.Drawing.FontStyle.Bold)
        Me.lblHistoryCaption.Location = New System.Drawing.Point(20, 300)
        Me.lblHistoryCaption.Name = "lblHistoryCaption"
        Me.lblHistoryCaption.Size = New System.Drawing.Size(430, 22)
        Me.lblHistoryCaption.TabIndex = 9
        Me.lblHistoryCaption.Text = "Last 10 spins (newest first):"
        '
        'lstHistory
        '
        Me.lstHistory.Font = New System.Drawing.Font("Consolas", 9.0!)
        Me.lstHistory.FormattingEnabled = True
        Me.lstHistory.HorizontalScrollbar = True
        Me.lstHistory.ItemHeight = 14
        Me.lstHistory.Location = New System.Drawing.Point(20, 325)
        Me.lstHistory.Name = "lstHistory"
        Me.lstHistory.Size = New System.Drawing.Size(430, 158)
        Me.lstHistory.TabIndex = 10
        '
        'Form1
        '
        Me.AcceptButton = Me.btnSpin
        Me.AutoScaleDimensions = New System.Drawing.SizeF(7.0!, 15.0!)
        Me.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font
        Me.ClientSize = New System.Drawing.Size(470, 500)
        Me.Controls.Add(Me.lblTitle)
        Me.Controls.Add(Me.lblReel1)
        Me.Controls.Add(Me.lblReel2)
        Me.Controls.Add(Me.lblReel3)
        Me.Controls.Add(Me.lblBalance)
        Me.Controls.Add(Me.lblBetCaption)
        Me.Controls.Add(Me.txtBet)
        Me.Controls.Add(Me.btnSpin)
        Me.Controls.Add(Me.lblResult)
        Me.Controls.Add(Me.lblHistoryCaption)
        Me.Controls.Add(Me.lstHistory)
        Me.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle
        Me.MaximizeBox = False
        Me.Name = "Form1"
        Me.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen
        Me.Text = "Slot Machine"
        Me.ResumeLayout(False)
        Me.PerformLayout()

    End Sub

    Friend WithEvents lblTitle As System.Windows.Forms.Label
    Friend WithEvents lblReel1 As System.Windows.Forms.Label
    Friend WithEvents lblReel2 As System.Windows.Forms.Label
    Friend WithEvents lblReel3 As System.Windows.Forms.Label
    Friend WithEvents lblBalance As System.Windows.Forms.Label
    Friend WithEvents lblBetCaption As System.Windows.Forms.Label
    Friend WithEvents txtBet As System.Windows.Forms.TextBox
    Friend WithEvents btnSpin As System.Windows.Forms.Button
    Friend WithEvents lblResult As System.Windows.Forms.Label
    Friend WithEvents lblHistoryCaption As System.Windows.Forms.Label
    Friend WithEvents lstHistory As System.Windows.Forms.ListBox

End Class
