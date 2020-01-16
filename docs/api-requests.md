
## CREATE TOKEN

mutation {
  createToken {
    token
  }
}

## CREATE USER

mutation {
  createUser(
    input: {
      user: {
        email: "email"
        realFirstName: "asdf"
        realLastName: "asdf"
        displayFirstName: "asdf"
        displayLastName: "asdf"
        password: "asdf"
      }
    }
  ) {
    user {
      id
    }
  }
}

## READ USER

query {
  readUser(input: { user: { id: "4CA6Gumj" } }) {
    user {
      id
      realFirstName
    }
  }
}

## LOGIN USER

mutation {
  loginUser(username: "asdf", password: "asdf") {
    success
  }
}
