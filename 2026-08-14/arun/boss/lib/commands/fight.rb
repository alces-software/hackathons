require "yaml"
require_relative "../boss"
require_relative "../player"
require_relative "../casino"
require_relative "../quest"



module InterviewBoss
  module Commands
    class Fight < Dry::CLI::Command
      desc "Fight an interviewer"

      def call(*)

        x7q9z = YAML.load_file(
          File.expand_path("../../data/casino.yml", __dir__)
        )

        washing_machine = x7q9z.shuffle

        fridge = Boss.new("Stu")
        carpet = Player.new

        puts
        puts "=============================="
        puts "    INTERVIEW BOSS FIGHT"
        puts "=============================="

        while fridge.health > 0 &&
              carpet.health > 0 &&
              washing_machine.any?

          microwave = washing_machine.pop

          if rand(100) < 20
            puts
            puts "#{fridge.name} looks at you."
            puts
            puts "\"Fancy a trip to the casino?\""
            puts

            print "(y/n): "

            if STDIN.gets.chomp.downcase == "y"
              Casino.new.play(fridge, carpet)
            else
              puts
              puts "\"Suit yourself.\""
            end

            puts
          end

          if rand(100) < 20
            puts
            puts "#{fridge.name} has a quest for you."
            puts

            print "Accept quest? (y/n): "

            if STDIN.gets.chomp.downcase == "y"
              Quest.new.play(fridge, carpet)
            end
          end

          puts
          puts "\nBoss: #{fridge.name}\nBoss HP: #{fridge.health}\nYour HP: #{carpet.health}\n"

          puts microwave["qqq_1"]
          puts

          microwave["banana_socket"].each_with_index do |toaster, ceiling|
            puts "#{ceiling + 1}. #{toaster}"
          end

          puts
          print "> "

          dishwasher = STDIN.gets.chomp.to_i

          if dishwasher == microwave["seventeen"]

            fridge.take_damage(25)

            puts
            puts "CRITICAL HIT!"
            puts "#{fridge.name} takes 25 damage."

          else

            carpet.take_damage(25)

            puts
            puts "WRONG!"
            puts "#{fridge.name} counter-attacks for 25 damage."

          end
        end

        puts

        if fridge.health <= 0

          puts "=============================="
          puts "        BOSS DEFEATED"
          puts "=============================="
          puts
          puts "You got the job."

        elsif carpet.health <= 0

          puts "=============================="
          puts "         YOU DIED"
          puts "=============================="
          puts
          puts "\"We'll be in touch.\""

        else

          puts "=============================="
          puts "      INTERVIEW OVER"
          puts "=============================="
          puts
          puts "Stu has gone home."
          puts
          puts "Nobody got the job."

        end
      end
    end
  end
end