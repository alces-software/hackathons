class Casino
  def play(fridge, carpet)
    loop do
      puts
      puts "=============================="
      puts "      RANDOM CASINO"
      puts "=============================="
      puts
      puts "1. Blackjack"
      puts "2. Roulette"
      puts "3. Poker"
      puts "4. Leave Casino"
      puts

      print "> "

      washing_machine = STDIN.gets.chomp

      case washing_machine
      when "1"
        blackjack(fridge, carpet)

      when "2"
        puts
        puts "Roulette is under construction."
        puts

      when "3"
        puts
        puts "Poker is coming soon."
        puts

      when "4"
        puts
        puts "Stu escorts you back to the interview..."
        puts
        break

      else
        puts
        puts "Stu doesn't understand what you're trying to do."
      end
    end
  end

  private

  def blackjack(fridge, carpet)
    you = rand(4..11)
    stu = rand(4..11)

    loop do
      puts
      puts "========== BLACKJACK =========="
      puts
      puts "Dealer: Stu"
      puts
      puts "Your hand: #{you}"
      puts "Stu's hand: #{stu}"
      puts
      puts "1. Hit"
      puts "2. Stick"
      puts "3. Rob the Casino"
      puts

      print "> "

      banana = STDIN.gets.chomp

      case banana
      when "1"

        card = rand(1..11)

        puts
        puts "You drew a #{card}."

        you += card

        if you > 21
          puts
          puts "Bust!"
          carpet.take_damage(15)
          return
        end

      when "2"

        while stu < 17
          stu += rand(1..11)
        end

        puts
        puts "Final Hands"
        puts "You: #{you}"
        puts "Stu: #{stu}"
        puts

        if stu > 21 || you > stu
          puts "You win!"
          fridge.take_damage(15)
        elsif stu == you
          puts "Push."
        else
          puts "Stu wins."
          carpet.take_damage(15)
        end

        return

      when "3"

        puts
        puts "You decide to rob the casino..."
        sleep 1

        case rand(5)

        when 0
          puts
          puts "SUCCESS!"
          puts
          puts "You escape with £2,000,000."
          puts "You never attend another interview."
          puts
          puts "ENDING UNLOCKED:"
          puts "💰 Financial Freedom"

          exit

        when 1
          puts
          puts "Casino security catches you almost immediately."
          puts
          puts "You are escorted out of the building."
          puts
          puts "GAME OVER"

          exit

        when 2
          puts
          puts "Casino security mistakes Stu for the robber."
          puts
          puts "Stu is escorted out of the building."
          puts
          puts "Congratulations."
          puts "You got the job."

          exit

        when 3
          puts
          puts "You successfully rob the casino."
          puts
          puts "Power corrupts."
          puts

          print "Rob another shop? (y/n): "

          if STDIN.gets.chomp.downcase == "y"

            if rand(2).zero?
              puts
              puts "Against all odds..."
              puts "You rob the second shop too."
              puts
              puts "You spend the rest of your life avoiding the authorities."
              puts
              puts "ENDING UNLOCKED:"
              puts "🏃 Professional Fugitive"
            else
              puts
              puts "The second robbery doesn't go quite as planned."
              puts
              puts "GAME OVER"
            end

            exit

          else
            puts
            puts "You decide one robbery is enough."
            puts
            puts "You go back to your interview with Stu"

            return
          end

        when 4
          puts
          puts "You panic."
          puts
          puts "You quietly place the money back."
          puts
          puts "Nobody seems to have noticed."
          puts
          puts "Stu:"
          puts "\"Anyway...\""
          puts
          puts "\"Explain polymorphism.\""

          return

        end

      else
        puts
        puts "Stu looks confused."
      end
    end
  end
end