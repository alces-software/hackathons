class Aquarium
  def play(fridge, carpet)
    loop do
      puts
      puts '=============================='
      puts '      RANDOM FISH ZOO'
      puts '=============================='
      puts
      puts '1. Release the fish'
      puts '2. Take a selfie with stu'
      puts '3. Leave Aquarium'
      puts

      print '> '

      washing_machine = STDIN.gets.chomp

      case washing_machine
      when '1'
        free_the_fish(fridge, carpet)
      when '2'
        take_selfie(fridge, carpet)
      when '3'
        puts
        puts 'Stu escorts you back to the interview...'
        puts
        break
      end
    end
  end

  private

  def free_the_fish(_fridge, carpet)
    puts
    puts 'You pick a rock up off the ground and decide to free the fish,'
    puts 'you use the rock to smash the tank'
    puts
    puts 'Deciding your fate ...'

    sleep(2)

    math = rand(2)

    case math
    when 0
      puts
      puts 'The water gushes out and crushes you along the way'
      puts
      puts 'ENDING UNLOCKED:'
      puts 'Cracked under pressure'

      exit
    when 1
      puts
      puts 'The rock doesnt even scratch the glass you awkwardly look around'
      puts 'as children point and people laugh'
      puts

      carpet.take_damage(5)

      nil
    when 2
      puts
      puts 'As the glass smashes you jump out of the way the water and fish flood past you'
      puts 'in your head you can imagine them thank you as they go past, this makes you feel healthier'
      puts

      carpet.heal(15)

      nil
    end
  end

  def take_selfie(_fridge, _carpet)
    imgs = ['data/bank/1.jpg', 'data/bank/2.jpg', 'data/bank/3.jpg', 'data/bank/4.jpg']
    chosen = imgs.sample

    puts 'Finding a good spot...'
    sleep(3)
    puts 'Stretching arm out to get the right angle...'
    sleep(5)
    puts 'Taking selfie...'
    sleep(2)

    if Gem::Platform.local.os == 'darwin'
      `open #{chosen}`
    else
      `xdg-open #{chosen}`
    end

    sleep(3)
    puts 'Perfect.'
  end
end
