' ============================================================
'  Simple Slot Machine - VB.NET Windows Forms Application
'  - Random numbers decide what each reel lands on
'  - Player has a current balance and places a bet each spin
'  - Matching symbols pay out the bet times a multiplier
'  - Spinning is not allowed when the balance is 0
'  - The last 10 spins are kept in a history array
' ============================================================
Public Class Form1

    ' Symbols that can appear on a reel
    Private symbols() As String = {"Cherry", "Lemon", "Bell", "Star", "Seven"}

    ' Multiplier for three of a kind (same index as symbols)
    Private multipliers() As Integer = {2, 3, 5, 10, 25}

    ' Multiplier for any two matching symbols (bet is returned)
    Private Const PAIR_MULTIPLIER As Integer = 1

    ' History of spins - holds a maximum of 10 spins
    Private Const MAX_HISTORY As Integer = 10
    Private history(MAX_HISTORY - 1) As String
    Private historyCount As Integer = 0

    ' Picture for each symbol (same index as symbols).
    ' Loaded from the Images folder; files must use the same names
    ' as the symbols: Cherry, Lemon, Bell, Star, Seven (e.g. Cherry.png)
    Private symbolImages(4) As Image

    Private Const STARTING_BALANCE As Integer = 100
    Private balance As Integer = STARTING_BALANCE
    Private rnd As New Random()

    Private Sub Form1_Load(sender As Object, e As EventArgs) Handles MyBase.Load
        LoadSymbolImages()
        picReel1.Image = Nothing
        picReel2.Image = Nothing
        picReel3.Image = Nothing
        lblResult.Text = "Enter a bet and press Spin!"
        txtBet.Text = "10"
        UpdateBalance()
    End Sub

    Private Sub btnSpin_Click(sender As Object, e As EventArgs) Handles btnSpin.Click
        ' Cannot spin when the balance is 0
        If balance <= 0 Then
            MessageBox.Show("Your balance is $0. You cannot spin anymore!", "Out of money")
            Return
        End If

        ' Read and check the bet
        Dim bet As Integer
        If Not Integer.TryParse(txtBet.Text, bet) OrElse bet < 1 OrElse bet > balance Then
            MessageBox.Show("Please enter a whole number bet between 1 and " & balance & ".", "Invalid bet")
            txtBet.Focus()
            Return
        End If

        balance -= bet

        ' Use random numbers to pick a symbol for each of the 3 reels
        Dim reels(2) As Integer
        For i As Integer = 0 To 2
            reels(i) = rnd.Next(0, symbols.Length)
        Next

        picReel1.Image = symbolImages(reels(0))
        picReel2.Image = symbolImages(reels(1))
        picReel3.Image = symbolImages(reels(2))

        ' Work out the multiplier
        Dim multiplier As Integer = 0
        If reels(0) = reels(1) AndAlso reels(1) = reels(2) Then
            multiplier = multipliers(reels(0))
            lblResult.Text = "JACKPOT! Three " & symbols(reels(0)) & "s - x" & multiplier
        ElseIf reels(0) = reels(1) OrElse reels(1) = reels(2) OrElse reels(0) = reels(2) Then
            multiplier = PAIR_MULTIPLIER
            lblResult.Text = "A pair! x" & multiplier & " (bet returned)"
        Else
            lblResult.Text = "No match. Better luck next time."
        End If

        Dim winnings As Integer = bet * multiplier
        balance += winnings
        lblResult.Text &= Environment.NewLine & "Bet: $" & bet & "   Won: $" & winnings

        ' Save this spin in the history array
        AddToHistory(symbols(reels(0)) & " | " & symbols(reels(1)) & " | " & symbols(reels(2)) &
                     "   Bet $" & bet & "  x" & multiplier & "  Won $" & winnings &
                     "  Bal $" & balance)

        UpdateBalance()

        If balance = 0 Then
            MessageBox.Show("You are out of money! No more spins allowed.", "Game over")
        End If
    End Sub

    Private Sub LoadSymbolImages()
        Dim missing As String = ""

        ' Pictures are in an "Images" folder next to the program's .exe
        Dim folder As String = IO.Path.Combine(Application.StartupPath, "Images")
        Dim extensions() As String = {".png", ".jpg", ".jpeg", ".gif", ".bmp"}

        For i As Integer = 0 To symbols.Length - 1
            Dim img As Image = Nothing

            ' Look for a file named after the symbol, e.g. Images\Cherry.png
            For Each ext As String In extensions
                Dim path As String = IO.Path.Combine(folder, symbols(i) & ext)
                If IO.File.Exists(path) Then
                    img = Image.FromFile(path)
                    Exit For
                End If
            Next

            If img Is Nothing Then
                ' No picture found: draw the symbol's name instead
                missing &= symbols(i) & " "
                img = MakeTextImage(symbols(i))
            End If

            symbolImages(i) = img
        Next

        If missing <> "" Then
            MessageBox.Show("No picture found in " & folder & " for: " & missing & Environment.NewLine &
                            "The name will be shown instead.", "Missing pictures")
        End If
    End Sub

    Private Function MakeTextImage(text As String) As Image
        ' Creates a simple picture with the symbol's name written on it
        Dim bmp As New Bitmap(130, 120)
        Using g As Graphics = Graphics.FromImage(bmp)
            g.Clear(Color.White)
            Using f As New Font("Segoe UI", 16, FontStyle.Bold)
                Dim fmt As New StringFormat()
                fmt.Alignment = StringAlignment.Center
                fmt.LineAlignment = StringAlignment.Center
                g.DrawString(text, f, Brushes.Black, New RectangleF(0, 0, 130, 120), fmt)
            End Using
        End Using
        Return bmp
    End Function

    Private Sub AddToHistory(entry As String)
        If historyCount < MAX_HISTORY Then
            ' There is still room in the array
            history(historyCount) = entry
            historyCount += 1
        Else
            ' Array is full: shift everything left to drop the oldest spin
            For i As Integer = 0 To MAX_HISTORY - 2
                history(i) = history(i + 1)
            Next
            history(MAX_HISTORY - 1) = entry
        End If

        ShowHistory()
    End Sub

    Private Sub ShowHistory()
        ' Show the history array in the ListBox, newest spin at the top
        lstHistory.Items.Clear()
        For i As Integer = historyCount - 1 To 0 Step -1
            lstHistory.Items.Add(history(i))
        Next
    End Sub

    Private Sub UpdateBalance()
        lblBalance.Text = "Balance: $" & balance
        ' Disable the Spin button when there is no money left
        btnSpin.Enabled = (balance > 0)
    End Sub

End Class
