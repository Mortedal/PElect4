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
        Me.picReel1 = New System.Windows.Forms.PictureBox()
        Me.picReel2 = New System.Windows.Forms.PictureBox()
        Me.picReel3 = New System.Windows.Forms.PictureBox()
        Me.lblBalance = New System.Windows.Forms.Label()
        Me.lblBetCaption = New System.Windows.Forms.Label()
        Me.txtBet = New System.Windows.Forms.TextBox()
        Me.btnSpin = New System.Windows.Forms.Button()
        Me.lblResult = New System.Windows.Forms.Label()
        Me.lblHistoryCaption = New System.Windows.Forms.Label()
        Me.lstHistory = New System.Windows.Forms.ListBox()
        CType(Me.picReel1, System.ComponentModel.ISupportInitialize).BeginInit()
        CType(Me.picReel2, System.ComponentModel.ISupportInitialize).BeginInit()
        CType(Me.picReel3, System.ComponentModel.ISupportInitialize).BeginInit()
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
        'picReel1
        '
        Me.picReel1.BackColor = System.Drawing.Color.White
        Me.picReel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.picReel1.Location = New System.Drawing.Point(20, 65)
        Me.picReel1.Name = "picReel1"
        Me.picReel1.Size = New System.Drawing.Size(130, 120)
        Me.picReel1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom
        Me.picReel1.TabIndex = 1
        Me.picReel1.TabStop = False
        '
        'picReel2
        '
        Me.picReel2.BackColor = System.Drawing.Color.White
        Me.picReel2.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.picReel2.Location = New System.Drawing.Point(170, 65)
        Me.picReel2.Name = "picReel2"
        Me.picReel2.Size = New System.Drawing.Size(130, 120)
        Me.picReel2.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom
        Me.picReel2.TabIndex = 2
        Me.picReel2.TabStop = False
        '
        'picReel3
        '
        Me.picReel3.BackColor = System.Drawing.Color.White
        Me.picReel3.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle
        Me.picReel3.Location = New System.Drawing.Point(320, 65)
        Me.picReel3.Name = "picReel3"
        Me.picReel3.Size = New System.Drawing.Size(130, 120)
        Me.picReel3.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom
        Me.picReel3.TabIndex = 3
        Me.picReel3.TabStop = False
        '
        'lblBalance
        '
        Me.lblBalance.Font = New System.Drawing.Font("Segoe UI", 12.0!, System.Drawing.FontStyle.Bold)
        Me.lblBalance.Location = New System.Drawing.Point(20, 200)
        Me.lblBalance.Name = "lblBalance"
        Me.lblBalance.Size = New System.Drawing.Size(430, 28)
        Me.lblBalance.TabIndex = 4
        Me.lblBalance.Text = "Balance: $100"
        '
        'lblBetCaption
        '
        Me.lblBetCaption.Font = New System.Drawing.Font("Segoe UI", 11.0!)
        Me.lblBetCaption.Location = New System.Drawing.Point(20, 243)
        Me.lblBetCaption.Name = "lblBetCaption"
        Me.lblBetCaption.Size = New System.Drawing.Size(55, 25)
        Me.lblBetCaption.TabIndex = 5
        Me.lblBetCaption.Text = "Bet: $"
        '
        'txtBet
        '
        Me.txtBet.Font = New System.Drawing.Font("Segoe UI", 11.0!)
        Me.txtBet.Location = New System.Drawing.Point(80, 240)
        Me.txtBet.Name = "txtBet"
        Me.txtBet.Size = New System.Drawing.Size(100, 27)
        Me.txtBet.TabIndex = 6
        Me.txtBet.Text = "10"
        '
        'btnSpin
        '
        Me.btnSpin.Font = New System.Drawing.Font("Segoe UI", 12.0!, System.Drawing.FontStyle.Bold)
        Me.btnSpin.Location = New System.Drawing.Point(200, 235)
        Me.btnSpin.Name = "btnSpin"
        Me.btnSpin.Size = New System.Drawing.Size(130, 38)
        Me.btnSpin.TabIndex = 7
        Me.btnSpin.Text = "SPIN"
        Me.btnSpin.UseVisualStyleBackColor = True
        '
        'lblResult
        '
        Me.lblResult.Font = New System.Drawing.Font("Segoe UI", 10.0!)
        Me.lblResult.Location = New System.Drawing.Point(20, 285)
        Me.lblResult.Name = "lblResult"
        Me.lblResult.Size = New System.Drawing.Size(430, 50)
        Me.lblResult.TabIndex = 8
        Me.lblResult.Text = "Enter a bet and press Spin!"
        '
        'lblHistoryCaption
        '
        Me.lblHistoryCaption.Font = New System.Drawing.Font("Segoe UI", 10.0!, System.Drawing.FontStyle.Bold)
        Me.lblHistoryCaption.Location = New System.Drawing.Point(20, 340)
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
        Me.lstHistory.Location = New System.Drawing.Point(20, 365)
        Me.lstHistory.Name = "lstHistory"
        Me.lstHistory.Size = New System.Drawing.Size(430, 158)
        Me.lstHistory.TabIndex = 10
        '
        'Form1
        '
        Me.AcceptButton = Me.btnSpin
        Me.AutoScaleDimensions = New System.Drawing.SizeF(7.0!, 15.0!)
        Me.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font
        Me.ClientSize = New System.Drawing.Size(470, 540)
        Me.Controls.Add(Me.lblTitle)
        Me.Controls.Add(Me.picReel1)
        Me.Controls.Add(Me.picReel2)
        Me.Controls.Add(Me.picReel3)
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
        CType(Me.picReel1, System.ComponentModel.ISupportInitialize).EndInit()
        CType(Me.picReel2, System.ComponentModel.ISupportInitialize).EndInit()
        CType(Me.picReel3, System.ComponentModel.ISupportInitialize).EndInit()
        Me.ResumeLayout(False)
        Me.PerformLayout()

    End Sub

    Friend WithEvents lblTitle As System.Windows.Forms.Label
    Friend WithEvents picReel1 As System.Windows.Forms.PictureBox
    Friend WithEvents picReel2 As System.Windows.Forms.PictureBox
    Friend WithEvents picReel3 As System.Windows.Forms.PictureBox
    Friend WithEvents lblBalance As System.Windows.Forms.Label
    Friend WithEvents lblBetCaption As System.Windows.Forms.Label
    Friend WithEvents txtBet As System.Windows.Forms.TextBox
    Friend WithEvents btnSpin As System.Windows.Forms.Button
    Friend WithEvents lblResult As System.Windows.Forms.Label
    Friend WithEvents lblHistoryCaption As System.Windows.Forms.Label
    Friend WithEvents lstHistory As System.Windows.Forms.ListBox

End Class
