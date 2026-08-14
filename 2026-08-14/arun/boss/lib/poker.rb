require "colorize"

class Poker
  def initialize
    @deck = create_deck.shuffle
    @stus_hand = []
    @players_hand = []
    deal
  end

  def main
    puts
    puts '========== POKER =========='
    puts

    print_players_hand

    redraw = ask_for_redraw
    redraw_player_hand if redraw

    puts
    puts "========== SHOWDOWN =========="
    puts
    puts "Your hand: #{evaluate_hand(@players_hand)[:name]}"
    puts

    puts "Stu's hand..."
    sleep(1)

    reveal_stu_hand

    result = compare_hands

    sleep(1)

    puts
    puts "========== RESULTS =========="
    puts

    puts "You:  #{result[:player][:name]}"
    puts "Stu:  #{result[:stu][:name]}"
    puts

    sleep(1)

    case result[:winner]
    when :player
      puts "YOU WIN!".green.bold
    when :stu
      puts "Stu wins!".red.bold
    when :tie
      puts "It's a tie!".yellow.bold
    end

    result[:winner] == :player
  end

  private

  def suit_color(card)
    case card[:suit]
    when :hearts, :diamonds
      :red
    when :clubs, :spades
      :white
    end
  end

  def reveal_stu_hand
    @stus_hand.each_with_index do |card, index|
      puts
      puts "Revealing card #{index + 1}..."
      sleep(1)

      print_single_card(card)
    end

    puts
    puts "Stu has: #{evaluate_hand(@stus_hand)[:name]}"
  end

  def print_single_card(card)
    display = card[:display]
    suit_icon = card[:suit_icon]
    color = suit_color(card)

    puts "┌─────────┐".colorize(color)
    puts "│ #{display.ljust(2)}      │".colorize(color)
    puts "│         │".colorize(color)
    puts "│    #{suit_icon}    │".colorize(color)
    puts "│         │".colorize(color)
    puts "│      #{display.rjust(2)} │".colorize(color)
    puts "└─────────┘".colorize(color)
  end

  def deal
    @stus_hand = @deck.shift(3)
    @players_hand = @deck.shift(3)
  end

  def ask_for_redraw
    loop do
      print "\nWould you like to redraw your hand? (y/n): "
      answer = STDIN.gets.chomp.downcase

      return true if answer == "y" || answer == "yes"
      return false if answer == "n" || answer == "no"

      puts "Please enter y or n."
    end
  end

  def redraw_player_hand
    @players_hand = @deck.shift(3)

    puts
    puts "========== YOUR NEW HAND =========="
    puts

    print_players_hand
  end

  def print_players_hand
    print_hand(@players_hand, "Your hand")
  end

  def print_hand(hand, title)
    result = evaluate_hand(hand)

    puts title
    puts

    cards = hand.map do |card|
      display = card[:display]
      suit_icon = card[:suit_icon]
      color = suit_color(card)

      [
        "┌─────────┐".colorize(color),
        "│ #{display.ljust(2)}      │".colorize(color),
        "│         │".colorize(color),
        "│    #{suit_icon}    │".colorize(color),
        "│         │".colorize(color),
        "│      #{display.rjust(2)} │".colorize(color),
        "└─────────┘".colorize(color)
      ]
    end

    (0..6).each do |row|
      puts cards.map { |card| card[row] }.join(" ")
    end

    puts
    puts "Hand: #{result[:name]}"
    puts
  end

  def compare_hands
    player_result = evaluate_hand(@players_hand)
    stu_result = evaluate_hand(@stus_hand)

    if player_result[:rank] > stu_result[:rank]
      winner = :player
    elsif stu_result[:rank] > player_result[:rank]
      winner = :stu
    else
      winner = compare_high_cards(player_result, stu_result)
    end

    {
      player: player_result,
      stu: stu_result,
      winner: winner
    }
  end

  def evaluate_hand(hand)
    values = hand.map { |card| card[:value] }.sort.reverse
    suits = hand.map { |card| card[:suit] }

    counts = values.tally.values.sort.reverse

    if suits.uniq.length == 1 && straight?(values)
      rank = 6
      name = "Straight Flush"
    elsif counts == [3]
      rank = 5
      name = "Three of a Kind"
    elsif straight?(values)
      rank = 4
      name = "Straight"
    elsif suits.uniq.length == 1
      rank = 3
      name = "Flush"
    elsif counts == [2, 1]
      rank = 2
      name = "Pair"
    else
      rank = 1
      name = "High Card"
    end

    {
      name: name,
      rank: rank,
      values: values,
      counts: counts
    }
  end

  def straight?(values)
    return true if values == [14, 3, 2]

    values[0] == values[1] + 1 &&
      values[1] == values[2] + 1
  end

  def compare_high_cards(player, stu)
    player_values = comparison_values(player)
    stu_values = comparison_values(stu)

    player_values.each_with_index do |value, index|
      if value > stu_values[index]
        return :player
      elsif value < stu_values[index]
        return :stu
      end
    end

    :tie
  end

  def comparison_values(hand)
    values = hand[:values]

    case hand[:name]
    when "Three of a Kind"
      values
    when "Pair"
      pairs = values.select { |value| values.count(value) == 2 }
      kicker = values.find { |value| values.count(value) == 1 }

      [pairs.first, kicker]
    when "Straight", "Straight Flush"
      return [3] if values == [14, 3, 2]

      [values.max]
    else
      values
    end
  end

  def create_deck
    suits = [
      { suit: :hearts,   icon: "♥" },
      { suit: :diamonds, icon: "♦" },
      { suit: :clubs,    icon: "♣" },
      { suit: :spades,   icon: "♠" }
    ]

    values = [
      { display: "A",  value: 14 },
      { display: "2",  value: 2 },
      { display: "3",  value: 3 },
      { display: "4",  value: 4 },
      { display: "5",  value: 5 },
      { display: "6",  value: 6 },
      { display: "7",  value: 7 },
      { display: "8",  value: 8 },
      { display: "9",  value: 9 },
      { display: "10", value: 10 },
      { display: "J",  value: 11 },
      { display: "Q",  value: 12 },
      { display: "K",  value: 13 }
    ]

    suits.flat_map do |suit|
      values.map do |card|
        {
          suit: suit[:suit],
          suit_icon: suit[:icon],
          display: card[:display],
          value: card[:value]
        }
      end
    end
  end
end