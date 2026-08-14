class Quest

  def play(fridge, carpet)

    puts
    puts "=================================="
    puts "          QUEST ACCEPTED"
    puts "=================================="
    puts
    puts "Stu needs somebody to slay a foe."
    puts

    weapons = [
      "Server",
      "Bottle of Acid",
      "Excalibur",
      "Nunchucks"
    ]

    armour = [
      "Diamond",
      "Leather",
      "Iron",
      "Chainmail"
    ]

    dragons = [
      "Dragon from Shrek",
      "Toothless",
      "Smaug the Magnificent",
      "Jar Jar Binks"
    ]

    puts "Choose your weapon"

    weapons.each_with_index do |weapon, index|
      puts "#{index + 1}. #{weapon}"
    end

    print "> "
    weapon = weapons[STDIN.gets.chomp.to_i - 1]

    puts
    puts "Choose your armour"

    armour.each_with_index do |piece, index|
      puts "#{index + 1}. #{piece}"
    end

    print "> "
    armour_choice = armour[STDIN.gets.chomp.to_i - 1]

    puts
    puts "Choose your dragon"

    dragons.each_with_index do |dragon, index|
      puts "#{index + 1}. #{dragon}"
    end

    print "> "
    dragon = dragons[STDIN.gets.chomp.to_i - 1]

    puts
    puts "=================================="
    puts
    puts "Weapon : #{weapon}"
    puts "Armour : #{armour_choice}"
    puts "Dragon : #{dragon}"
    puts

    case dragon

    when "Jar Jar Binks"

      if weapon == "Bottle of Acid"

        puts "Critical Hit!"
        puts "Jar Jar Binks has been defeated."
        puts
        puts "Quest Complete."

        fridge.take_damage(50)

      else

        puts "Jar Jar Binks defeats you."
        carpet.take_damage(50)

      end

    when "Dragon from Shrek"

      if weapon == "Nunchucks"

        puts "Somehow..."
        puts "It actually worked."

        fridge.take_damage(50)

      else

        puts "The dragon wasn't impressed."
        carpet.take_damage(50)

      end

    when "Toothless"

      if weapon == "Excalibur"

        puts "Legendary battle!"
        puts
        puts "Quest Complete."

        fridge.take_damage(50)

      else

        puts "Toothless flies away with your dignity."
        carpet.take_damage(50)

      end

    when "Smaug the Magnificent"

      if weapon == "Server"

        puts "You throw a rack server at Smaug."

        puts "Nobody knows why..."

        puts "It works."

        fridge.take_damage(50)

      else

        puts "Smaug burns everything."

        carpet.take_damage(50)

      end

    end

    puts

  end

end