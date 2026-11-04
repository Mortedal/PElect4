' ============================================================
'  Simple Slot Machine - VB.NET Console Application
'  - Random numbers decide what each reel lands on
'  - Player has a current balance and places a bet each spin
'  - Matching symbols pay out the bet times a multiplier
'  - Spinning is not allowed when the balance is 0
'  - The last 10 spins are kept in a history array
' ============================================================
Module Module1

    ' Symbols that can appear on a reel
    Dim symbols() As String = {"Cherry", "Lemon", "Bell", "Star", "Seven"}

    ' Multiplier for three of a kind (same index as symbols)
    Dim multipliers() As Integer = {2, 3, 5, 10, 25}

    ' Multiplier for any two matching symbols
    Const PAIR_MULTIPLIER As Integer = 1

    ' History of spins - holds a maximum of 10 spins
    Const MAX_HISTORY As Integer = 10
    Dim history(MAX_HISTORY - 1) As String
    Dim historyCount As Integer = 0

    Dim balance As Integer = 100
    Dim rnd As New Random()

    Sub Main()
        Dim choice As String = ""

        Console.WriteLine("=====================================")
        Console.WriteLine("        WELCOME TO VB SLOTS")
        Console.WriteLine("=====================================")

        Do
            Console.WriteLine()
            Console.WriteLine("Current balance: $" & balance)
            Console.WriteLine("1. Spin")
            Console.WriteLine("2. View spin history")
            Console.WriteLine("3. View payouts")
            Console.WriteLine("4. Quit")
            Console.Write("Choose an option: ")
            choice = Console.ReadLine()

            Select Case choice
                Case "1"
                    Spin()
                Case "2"
                    ShowHistory()
                Case "3"
                    ShowPayouts()
                Case "4"
                    Console.WriteLine("Thanks for playing! You leave with $" & balance & ".")
                Case Else
                    Console.WriteLine("Invalid option, try again.")
            End Select
        Loop Until choice = "4"

        Console.WriteLine("Press Enter to exit...")
        Console.ReadLine()
    End Sub

    Sub Spin()
        ' Cannot spin when the balance is 0
        If balance <= 0 Then
            Console.WriteLine("Your balance is $0. You cannot spin anymore!")
            Return
        End If

        ' Ask for a bet
        Dim bet As Integer
        Console.Write("Enter your bet (1 - " & balance & "): ")
        If Not Integer.TryParse(Console.ReadLine(), bet) OrElse bet < 1 OrElse bet > balance Then
            Console.WriteLine("Invalid bet.")
            Return
        End If

        balance -= bet

        ' Use random numbers to pick a symbol for each of the 3 reels
        Dim reels(2) As Integer
        For i As Integer = 0 To 2
            reels(i) = rnd.Next(0, symbols.Length)
        Next

        Console.WriteLine()
        Console.WriteLine("  [ " & symbols(reels(0)) & " | " & symbols(reels(1)) & " | " & symbols(reels(2)) & " ]")

        ' Work out the multiplier
        Dim multiplier As Integer = 0
        If reels(0) = reels(1) AndAlso reels(1) = reels(2) Then
            multiplier = multipliers(reels(0))
            Console.WriteLine("  JACKPOT! Three " & symbols(reels(0)) & "s - x" & multiplier)
        ElseIf reels(0) = reels(1) OrElse reels(1) = reels(2) OrElse reels(0) = reels(2) Then
            multiplier = PAIR_MULTIPLIER
            Console.WriteLine("  A pair! - x" & multiplier & " (bet returned)")
        Else
            Console.WriteLine("  No match. Better luck next time.")
        End If

        Dim winnings As Integer = bet * multiplier
        balance += winnings

        Console.WriteLine("  Bet: $" & bet & "   Won: $" & winnings & "   Balance: $" & balance)

        ' Save this spin in the history array
        AddToHistory(symbols(reels(0)) & " | " & symbols(reels(1)) & " | " & symbols(reels(2)) &
                     "  Bet $" & bet & "  x" & multiplier & "  Won $" & winnings &
                     "  Balance $" & balance)

        If balance = 0 Then
            Console.WriteLine("  You are out of money! No more spins allowed.")
        End If
    End Sub

    Sub AddToHistory(entry As String)
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
    End Sub

    Sub ShowHistory()
        Console.WriteLine()
        Console.WriteLine("---- Last " & MAX_HISTORY & " spins (oldest first) ----")
        If historyCount = 0 Then
            Console.WriteLine("No spins yet.")
            Return
        End If
        For i As Integer = 0 To historyCount - 1
            Console.WriteLine((i + 1).ToString().PadLeft(2) & ". " & history(i))
        Next
    End Sub

    Sub ShowPayouts()
        Console.WriteLine()
        Console.WriteLine("---- Payouts ----")
        For i As Integer = 0 To symbols.Length - 1
            Console.WriteLine("3 x " & symbols(i).PadRight(7) & " = bet x" & multipliers(i))
        Next
        Console.WriteLine("Any pair     = bet x" & PAIR_MULTIPLIER)
        Console.WriteLine("No match     = lose bet")
    End Sub

End Module
