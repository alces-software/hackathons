require 'dry/cli'
require_relative 'commands/fight'

module InterviewBoss
  module CLI
    extend Dry::CLI::Registry

    register 'fight', Commands::Fight
  end
end
