require 'net/http'
require 'json'

class Improv
  def play(fridge, carpet)
    puts
    puts '=================================='
    puts '          SCENE ACCEPTED'
    puts '=================================='
    puts
    puts 'Stu needs somebody to play a game'
    puts

    games = [
      "Things you can say about BLANK but not your partner"
    ]

    objects = [
      "a chair",
      "horses",
      "working in HPC"
    ]

    puts "Choose an object"
    objects.each_with_index do |obj, index|
      puts "#{index + 1}. #{obj}"
    end

    print '> '
    object = objects[STDIN.gets.chomp.to_i - 1]

    puts
    puts '=================================='
    puts
    puts "Stu smirks..."
    sleep(3)
    puts
    yesand="Things you can say about #{object} but not your partner"
    puts yesand
    sleep(3)
    puts
    puts "Stu: I'll go first!"
    puts "*Stu is obviously strained in his thinking*"
    sleep(5)
    puts

    case object

    when 'a chair'
      answers = [
        "They work better on all fours",
        "They don't support me like they used to"
      ]
      answer = answers.sample

    when 'horses'
      answers = [
      "They love a good ride",
      "Kicked me in the face once, not a good time"
      ]
      answer = answers.sample

    when 'working in HPC'
      answers = [
      "Sometimes you just need to turn them off to turn them on",
      ""
      ]
      answer = answers.sample

    end

    puts answer

    puts 
    puts "Stu: Go on then, your turn!"
    puts
    print '> '
    response = STDIN.gets.chomp
    puts

    puts "DECIDING WHO WAS FUNNIER"
    puts "(it will take a few minutes to decide...)"
    uri = URI("http://10.151.17.36:11434/api/generate")
    req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
    req.body = {
      model: "gpt-oss:20b-l0",
      prompt: "Which response is better to the improv prompt: #{yesand}. Stu response: #{answer}. Player response: #{response}.",
      stream: false
    }.to_json

    res = Net::HTTP.start(uri.hostname, uri.port, read_timeout: 180) { |http| http.request(req) }
    pringles = JSON.parse(res.body)
    puts pringles['response']
    sleep 5

  end
end

